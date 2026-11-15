import React, { useEffect, useState } from 'react';
import { ActivityIndicator, Image, Pressable, ScrollView, Text, TextInput, View } from 'react-native';
import { launchImageLibrary } from 'react-native-image-picker';
import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import { Screen } from '../../components/Screen';
import { AdminPageHeader } from '../../components/AdminPageHeader';
import { SwitchRow } from '../../components/SwitchRow';
import { colors, radius } from '../../theme/tokens';
import { FormField } from '../../components/FormField';
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
    return <Screen surface="admin" title="Edit Product" specRef="UI Design §5.3" />;
  }

  const previewUri = pickedImage?.uri ?? existingImageUrl ?? undefined;

  return (
    <Screen
      surface="admin"
      title={isEdit ? 'Edit Product' : 'Add Product'}
      specRef="UI Design §5.3"
      scroll={false}
      header={
        <AdminPageHeader
          title={isEdit ? 'Edit product' : 'Add product'}
          onBack={() => navigation.goBack()}
        />
      }
    >
      {/* No artboard for the product form (FR-029). It follows "Company
          Admin · Add / edit user", which is the admin form pattern: one
          white section card holding every field, admin-tone inputs, and a
          Cancel/Save pair pinned to the bottom at flex 1 / flex 2 with a
          NAVY primary — back-of-house forms commit in navy, not brand. */}
      <ScrollView className="flex-1" contentContainerStyle={{ gap: 14, paddingBottom: 8 }}>
        <View
          style={{ borderRadius: radius['5xl'], borderWidth: 1, borderColor: colors.borderCard }}
          className="bg-surface p-md gap-sm"
        >
          <FormField tone="admin" label="Name" placeholder="Name" value={name} onChangeText={setName} />

          <View className="gap-xs">
            <Text className="text-label text-text-body">Description</Text>
            <TextInput
              accessibilityLabel="Description"
              style={{
                borderWidth: 1.5,
                borderColor: colors.borderChip,
                borderRadius: radius.lg,
                height: 110,
              }}
              className="bg-surface px-md py-sm text-body text-text-primary"
              placeholder="Description"
              placeholderTextColor={colors.textSecondary}
              multiline
              textAlignVertical="top"
              value={description}
              onChangeText={setDescription}
            />
          </View>

          <View className="gap-xs">
            <Text className="text-label text-text-body">Image</Text>
            {previewUri ? (
              <Image
                source={{ uri: previewUri }}
                style={{ borderRadius: radius.lg }}
                className="w-full h-40 bg-neutral-soft"
                resizeMode="cover"
              />
            ) : null}
            <Pressable
              onPress={handlePickImage}
              accessibilityRole="button"
              style={{
                borderWidth: 1.5,
                borderStyle: 'dashed',
                borderColor: colors.borderChip,
                borderRadius: radius.lg,
              }}
              className="h-field items-center justify-center active:opacity-70"
            >
              <Text className="text-label text-text-secondary">
                {previewUri ? 'Change image' : 'Pick image (JPEG/PNG, max 2MB)'}
              </Text>
            </Pressable>
          </View>

          <FormField
            tone="admin"
            label="Price (paise)"
            placeholder="Whole number, e.g. 2500"
            keyboardType="number-pad"
            value={price}
            onChangeText={setPrice}
            hint="Stored as paise — 2500 is ₹25.00."
          />

          <SwitchRow label="Veg" value={isVeg} onValueChange={setIsVeg} onLabel="Veg" offLabel="Non-veg" />
          <SwitchRow
            label="Sold out"
            value={isSoldout}
            onValueChange={setIsSoldout}
            onLabel="Sold out"
            offLabel="Available"
          />
        </View>

        {errorMessage ? <Text className="text-body text-red-strong">{errorMessage}</Text> : null}
      </ScrollView>

      <View className="flex-row gap-sm pt-sm">
        <Pressable
          onPress={() => navigation.goBack()}
          disabled={saving}
          accessibilityRole="button"
          style={{ flex: 1, height: 56, borderRadius: radius.pill, borderWidth: 1.5, borderColor: colors.borderChip }}
          className="items-center justify-center active:opacity-70"
        >
          <Text className="text-price text-text-primary">Cancel</Text>
        </Pressable>
        <Pressable
          onPress={handleSave}
          disabled={saving}
          accessibilityRole="button"
          accessibilityState={{ disabled: saving }}
          style={{
            flex: 2,
            height: 56,
            borderRadius: radius.pill,
            backgroundColor: colors.primaryVariant,
            opacity: saving ? 0.6 : 1,
          }}
          className="flex-row items-center justify-center gap-xs"
        >
          {saving ? <ActivityIndicator size="small" color={colors.surface} /> : null}
          <Text className="text-price text-surface">{isEdit ? 'Save product' : 'Add product'}</Text>
        </Pressable>
      </View>
    </Screen>
  );
}
