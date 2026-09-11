import React, { useEffect, useState } from 'react';
import { Image, Pressable, Switch, Text, TextInput, View } from 'react-native';
import { launchImageLibrary } from 'react-native-image-picker';
import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import { Screen } from '../../components/Screen';
import { PrimaryButton } from '../../components/PrimaryButton';
import { createTypedClient, uploadFile } from '../../api/client';
import type { TenantAdminStaffStackParamList } from '../../navigation/TenantAdminStaffNavigator';
import type { paths } from '../../api/generated/004-company-admin-product-crud';

type Props = NativeStackScreenProps<TenantAdminStaffStackParamList, 'ProductCreateEdit'>;

const client = createTypedClient<paths>();
const MAX_IMAGE_BYTES = 2 * 1024 * 1024;
const ALLOWED_MIME_TYPES = ['image/jpeg', 'image/png'];

type PickedImage = { uri: string; mimeType: string; fileName: string };

/**
 * UI Design §5.3 — Name, Description, Image, Price, Is Veg (plus Sold Out,
 * added to this form on explicit request; UI Design's own §5.2 otherwise
 * only exposes it as the list screen's per-row switch). Description is a
 * real multi-line text area, not a single-line box (this task's own ask).
 * Image is required, JPEG/PNG only, max 2MB — enforced here client-side
 * before ever calling the backend, which independently enforces the same
 * limit (products.controller.ts). For a new product a photo must be picked
 * in this form; for an existing one, already having a photo counts —
 * replacing it is optional. Save is two backend calls in sequence:
 * create/update the product's fields, then (only when a new photo was
 * picked) POST it to /tenant/products/:id/image, which stores it in a
 * Supabase Storage bucket named by the company's own id (created
 * automatically on first upload).
 */
export function ProductCreateEditScreen({ route, navigation }: Props) {
  const { productId } = route.params;
  const isEdit = Boolean(productId);

  const [name, setName] = useState('');
  const [description, setDescription] = useState('');
  const [price, setPrice] = useState('');
  const [isVeg, setIsVeg] = useState(true);
  const [isSoldout, setIsSoldout] = useState(false);
  const [existingImageUrl, setExistingImageUrl] = useState<string | null>(null);
  const [pickedImage, setPickedImage] = useState<PickedImage | null>(null);
  const [loading, setLoading] = useState(isEdit);
  const [saving, setSaving] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  // Set once this screen's own Save has created a product (create mode
  // only — route.params.productId stays empty either way). Without this, a
  // retry after a failed image upload would re-POST and create a SECOND
  // product instead of PATCHing/retrying the one that already exists.
  const [createdProductId, setCreatedProductId] = useState<string | null>(null);
  const effectiveProductId = productId ?? createdProductId;

  useEffect(() => {
    if (!productId) return;
    (async () => {
      const { data, error } = await client.GET('/tenant/products/{productId}', {
        params: { path: { productId } },
      });
      if (!error && data) {
        setName(data.name ?? '');
        setDescription(data.description ?? '');
        setPrice(data.price !== undefined ? String(data.price) : '');
        setIsVeg(data.is_veg ?? true);
        setIsSoldout(data.is_soldout ?? false);
        setExistingImageUrl(data.image_url ?? null);
      }
      setLoading(false);
    })();
  }, [productId]);

  async function handlePickImage() {
    setErrorMessage(null);
    // launchImageLibrary requests the platform photo-access permission
    // itself; a denial surfaces as result.errorCode === 'permission' below.
    const result = await launchImageLibrary({ mediaType: 'photo', quality: 0.8 });
    if (result.errorCode === 'permission') {
      setErrorMessage('Photo library access is required to pick a product image.');
      return;
    }
    if (result.didCancel || !result.assets?.[0]) {
      return;
    }

    const asset = result.assets[0];
    const inferredMimeType = (asset.uri ?? '').toLowerCase().endsWith('.png') ? 'image/png' : 'image/jpeg';
    const mimeType = asset.type ?? inferredMimeType;
    if (!asset.uri || !ALLOWED_MIME_TYPES.includes(mimeType)) {
      setErrorMessage('Image must be JPEG or PNG.');
      return;
    }
    if (asset.fileSize && asset.fileSize > MAX_IMAGE_BYTES) {
      setErrorMessage('Image exceeds the maximum allowed size (2MB).');
      return;
    }

    setPickedImage({
      uri: asset.uri,
      mimeType,
      fileName: asset.fileName ?? `product.${mimeType === 'image/png' ? 'png' : 'jpg'}`,
    });
  }

  /**
   * Runs only when a new photo was picked — an unmodified existing photo
   * needs no re-upload. Uses uploadFile (raw XMLHttpRequest), not the typed
   * openapi-fetch client — see uploadFile's own docstring for why.
   */
  async function uploadImage(targetProductId: string): Promise<void> {
    if (!pickedImage) return;

    const result = await uploadFile(`/tenant/products/${targetProductId}/image`, 'image', {
      uri: pickedImage.uri,
      name: pickedImage.fileName,
      type: pickedImage.mimeType,
    });
    if (!result.ok) {
      throw new Error(result.message ?? 'Could not upload the product image.');
    }
  }

  async function handleSave() {
    const priceValue = Number(price);
    const missing = [
      !name.trim() && 'Name',
      !description.trim() && 'Description',
      (!Number.isInteger(priceValue) || priceValue <= 0) && 'a whole-number Price greater than 0',
      !pickedImage && !existingImageUrl && 'Image',
    ].filter((field): field is string => Boolean(field));
    if (missing.length > 0) {
      setErrorMessage(`Missing: ${missing.join(', ')}.`);
      return;
    }

    setSaving(true);
    setErrorMessage(null);

    const body = {
      name: name.trim(),
      description: description.trim(),
      price: priceValue,
      is_veg: isVeg,
      is_soldout: isSoldout,
    };
    const { data, error } = effectiveProductId
      ? await client.PATCH('/tenant/products/{productId}', {
          params: { path: { productId: effectiveProductId } },
          body,
        })
      : await client.POST('/tenant/products', { body });

    if (error) {
      setErrorMessage((error as { message?: string })?.message ?? 'Could not save product.');
      setSaving(false);
      return;
    }

    const resultingId = effectiveProductId ?? data?.id;
    if (resultingId && !effectiveProductId) {
      // Remember it immediately — if the image step below fails, pressing
      // Save again must PATCH this same product, not create a second one.
      setCreatedProductId(resultingId);
    }

    if (resultingId && pickedImage) {
      try {
        await uploadImage(resultingId);
      } catch (uploadError) {
        // The product's own fields are already saved at this point — only
        // the photo step failed. Stay on this screen (never navigate away
        // on a failure the user hasn't had a chance to read) so Save can be
        // pressed again to retry just the photo.
        setSaving(false);
        setErrorMessage(
          uploadError instanceof Error ? uploadError.message : 'Could not upload the product image.',
        );
        return;
      }
    }

    setSaving(false);
    navigation.goBack();
  }

  if (loading) {
    return <Screen title="Edit Product" specRef="UI Design §5.3" />;
  }

  const previewUri = pickedImage?.uri ?? existingImageUrl ?? undefined;

  return (
    <Screen title={isEdit ? 'Edit Product' : 'Add Product'} specRef="UI Design §5.3">
      <View className="gap-3">
        <TextInput
          className="border border-border rounded-lg px-3 py-2 text-text-primary"
          placeholder="Name"
          value={name}
          onChangeText={setName}
        />
        <TextInput
          className="border border-border rounded-lg px-3 py-2 text-text-primary"
          style={{ minHeight: 90, textAlignVertical: 'top' }}
          placeholder="Description"
          multiline
          numberOfLines={4}
          value={description}
          onChangeText={setDescription}
        />

        <View className="gap-2">
          {previewUri ? (
            <Image source={{ uri: previewUri }} className="w-full h-40 rounded-lg bg-background" resizeMode="cover" />
          ) : null}
          <Pressable
            className="rounded-pill items-center justify-center px-6 py-3 border border-border"
            onPress={handlePickImage}
          >
            <Text className="font-semibold text-center text-button text-text-secondary">
              {previewUri ? 'Change Image' : 'Pick Image (JPEG/PNG, max 2MB)'}
            </Text>
          </Pressable>
        </View>

        <TextInput
          className="border border-border rounded-lg px-3 py-2 text-text-primary"
          placeholder="Price (paise, whole number)"
          keyboardType="number-pad"
          value={price}
          onChangeText={setPrice}
        />
        <View className="flex-row items-center justify-between">
          <Text className="text-body text-text-primary">Is Veg</Text>
          <Switch value={isVeg} onValueChange={setIsVeg} />
        </View>
        <View className="flex-row items-center justify-between">
          <Text className="text-body text-text-primary">Sold Out</Text>
          <Switch value={isSoldout} onValueChange={setIsSoldout} />
        </View>

        {errorMessage ? <Text className="text-body text-red-600">{errorMessage}</Text> : null}

        <View className="flex-row gap-3">
          <Pressable
            className="flex-1 rounded-pill items-center justify-center px-6 py-3 border border-border"
            onPress={() => navigation.goBack()}
            disabled={saving}
          >
            <Text className="font-semibold text-center text-button text-text-secondary">Cancel</Text>
          </Pressable>
          <View className="flex-1">
            <PrimaryButton label={isEdit ? 'Update' : 'Save'} onPress={handleSave} loading={saving} disabled={saving} />
          </View>
        </View>
      </View>
    </Screen>
  );
}
