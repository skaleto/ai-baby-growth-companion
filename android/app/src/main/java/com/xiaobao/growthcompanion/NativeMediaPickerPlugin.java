package com.xiaobao.growthcompanion;

import android.app.Activity;
import android.content.ContentResolver;
import android.content.Intent;
import android.database.Cursor;
import android.graphics.Bitmap;
import android.graphics.BitmapFactory;
import android.net.Uri;
import android.os.Build;
import android.provider.MediaStore;
import android.provider.OpenableColumns;
import android.webkit.MimeTypeMap;

import androidx.activity.result.ActivityResult;

import com.getcapacitor.JSArray;
import com.getcapacitor.JSObject;
import com.getcapacitor.Plugin;
import com.getcapacitor.PluginCall;
import com.getcapacitor.PluginMethod;
import com.getcapacitor.annotation.ActivityCallback;
import com.getcapacitor.annotation.CapacitorPlugin;

import java.io.File;
import java.io.FileOutputStream;
import java.io.InputStream;
import java.text.SimpleDateFormat;
import java.util.Date;
import java.util.Locale;
import java.util.UUID;

@CapacitorPlugin(name = "NativeMediaPicker")
public class NativeMediaPickerPlugin extends Plugin {
    private static final int MAX_SELECTION_LIMIT = 50;
    private int pendingLimit = 1;

    @PluginMethod
    public void pickMedia(PluginCall call) {
        pendingLimit = Math.max(1, Math.min(call.getInt("limit", 1), MAX_SELECTION_LIMIT));
        Intent intent = createPickerIntent(pendingLimit);
        try {
            startActivityForResult(call, intent, "pickMediaResult");
        } catch (Exception error) {
            call.reject("Unable to open media picker", error);
        }
    }

    @ActivityCallback
    private void pickMediaResult(PluginCall call, ActivityResult result) {
        if (call == null) return;
        if (result.getResultCode() != Activity.RESULT_OK || result.getData() == null) {
            JSObject response = new JSObject();
            response.put("items", new JSArray());
            call.resolve(response);
            return;
        }

        JSArray items = new JSArray();
        Intent data = result.getData();
        try {
            if (data.getClipData() != null) {
                int count = Math.min(data.getClipData().getItemCount(), pendingLimit);
                for (int index = 0; index < count; index += 1) {
                    JSObject item = copyPickedUri(data.getClipData().getItemAt(index).getUri());
                    if (item != null) items.put(item);
                }
            } else if (data.getData() != null) {
                JSObject item = copyPickedUri(data.getData());
                if (item != null) items.put(item);
            }
        } catch (Exception error) {
            call.reject("Failed to read selected media", error);
            return;
        }

        JSObject response = new JSObject();
        response.put("items", items);
        call.resolve(response);
    }

    private Intent createPickerIntent(int limit) {
        Intent intent;
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.TIRAMISU) {
            intent = new Intent(MediaStore.ACTION_PICK_IMAGES);
            if (limit > 1) {
                intent.putExtra(MediaStore.EXTRA_PICK_IMAGES_MAX, Math.min(limit, MediaStore.getPickImagesMaxLimit()));
            }
            intent.putExtra(Intent.EXTRA_ALLOW_MULTIPLE, limit > 1);
            if (intent.resolveActivity(getContext().getPackageManager()) != null) {
                intent.addFlags(Intent.FLAG_GRANT_READ_URI_PERMISSION);
                return intent;
            }
        }

        intent = new Intent(Intent.ACTION_OPEN_DOCUMENT);
        intent.addCategory(Intent.CATEGORY_OPENABLE);
        intent.setType("*/*");
        intent.putExtra(Intent.EXTRA_MIME_TYPES, new String[] { "image/*", "video/*" });
        intent.putExtra(Intent.EXTRA_ALLOW_MULTIPLE, limit > 1);
        intent.addFlags(Intent.FLAG_GRANT_READ_URI_PERMISSION);
        return intent;
    }

    private JSObject copyPickedUri(Uri sourceUri) throws Exception {
        ContentResolver resolver = getContext().getContentResolver();
        String mimeType = resolver.getType(sourceUri);
        if (mimeType == null || (!mimeType.startsWith("image/") && !mimeType.startsWith("video/"))) {
            return null;
        }

        String displayName = displayName(sourceUri);
        boolean normalizeImage = shouldNormalizeImage(mimeType);
        if (normalizeImage) {
            mimeType = "image/jpeg";
        }
        String extension = normalizeImage ? "jpg" : extensionFor(mimeType, displayName);
        File cacheDir = new File(getContext().getCacheDir(), "native_media_picker");
        if (!cacheDir.exists() && !cacheDir.mkdirs()) {
            throw new IllegalStateException("Unable to create media cache directory");
        }
        File destination = new File(cacheDir, UUID.randomUUID() + "." + extension);

        if (normalizeImage) {
            try (InputStream input = resolver.openInputStream(sourceUri);
                 FileOutputStream output = new FileOutputStream(destination)) {
                if (input == null) throw new IllegalStateException("Unable to open selected image");
                Bitmap bitmap = BitmapFactory.decodeStream(input);
                if (bitmap == null) throw new IllegalStateException("Unable to decode selected image");
                if (!bitmap.compress(Bitmap.CompressFormat.JPEG, 92, output)) {
                    throw new IllegalStateException("Unable to normalize selected image");
                }
            }
        } else {
            try (InputStream input = resolver.openInputStream(sourceUri);
                 FileOutputStream output = new FileOutputStream(destination)) {
                if (input == null) throw new IllegalStateException("Unable to open selected media");
                byte[] buffer = new byte[1024 * 128];
                int read;
                while ((read = input.read(buffer)) != -1) {
                    output.write(buffer, 0, read);
                }
            }
        }

        JSObject item = new JSObject();
        item.put("uri", Uri.fromFile(destination).toString());
        item.put("name", normalizeDisplayName(displayName, extension));
        item.put("mimeType", mimeType);
        item.put("kind", mimeType.startsWith("video/") ? "video" : "image");
        item.put("size", destination.length());
        String capturedAt = captureDate(sourceUri);
        if (capturedAt != null) {
            item.put("capturedAt", capturedAt);
        }
        return item;
    }

    private String captureDate(Uri uri) {
        String[] columns = new String[] {
            "datetaken",
            MediaStore.MediaColumns.DATE_MODIFIED,
            MediaStore.MediaColumns.DATE_ADDED
        };
        try (Cursor cursor = getContext().getContentResolver().query(uri, columns, null, null, null)) {
            if (cursor == null || !cursor.moveToFirst()) return null;
            long dateTakenMs = longColumn(cursor, "datetaken");
            if (dateTakenMs > 0) return localIsoString(dateTakenMs);

            long modifiedSeconds = longColumn(cursor, MediaStore.MediaColumns.DATE_MODIFIED);
            if (modifiedSeconds > 0) return localIsoString(modifiedSeconds * 1000L);

            long addedSeconds = longColumn(cursor, MediaStore.MediaColumns.DATE_ADDED);
            if (addedSeconds > 0) return localIsoString(addedSeconds * 1000L);
        } catch (Exception ignored) {
            // Some document providers do not expose media timestamps.
        }
        return null;
    }

    private long longColumn(Cursor cursor, String columnName) {
        int index = cursor.getColumnIndex(columnName);
        if (index < 0 || cursor.isNull(index)) return 0L;
        try {
            return cursor.getLong(index);
        } catch (Exception ignored) {
            return 0L;
        }
    }

    private String localIsoString(long epochMs) {
        return new SimpleDateFormat("yyyy-MM-dd'T'HH:mm:ss", Locale.US).format(new Date(epochMs));
    }

    private String displayName(Uri uri) {
        try (Cursor cursor = getContext().getContentResolver().query(uri, null, null, null, null)) {
            if (cursor != null && cursor.moveToFirst()) {
                int index = cursor.getColumnIndex(OpenableColumns.DISPLAY_NAME);
                if (index >= 0) {
                    String value = cursor.getString(index);
                    if (value != null && !value.trim().isEmpty()) return value.trim();
                }
            }
        } catch (Exception ignored) {
            // Fall back to a generated name below.
        }
        return "media";
    }

    private String extensionFor(String mimeType, String displayName) {
        String nameExtension = "";
        int dotIndex = displayName == null ? -1 : displayName.lastIndexOf('.');
        if (dotIndex >= 0 && dotIndex < displayName.length() - 1) {
            nameExtension = displayName.substring(dotIndex + 1).toLowerCase(Locale.ROOT);
        }
        if (!nameExtension.isEmpty()) return nameExtension;
        String fromMime = MimeTypeMap.getSingleton().getExtensionFromMimeType(mimeType);
        if (fromMime != null && !fromMime.isEmpty()) return fromMime;
        return mimeType.startsWith("video/") ? "mp4" : "jpg";
    }

    private boolean shouldNormalizeImage(String mimeType) {
        if (mimeType == null || !mimeType.startsWith("image/")) return false;
        return !mimeType.equals("image/jpeg")
            && !mimeType.equals("image/png")
            && !mimeType.equals("image/webp")
            && !mimeType.equals("image/gif");
    }

    private String normalizeDisplayName(String displayName, String extension) {
        String name = displayName == null || displayName.trim().isEmpty() ? "media" : displayName.trim();
        int dotIndex = name.lastIndexOf('.');
        if (dotIndex >= 0) {
            String currentExtension = name.substring(dotIndex + 1).toLowerCase(Locale.ROOT);
            if ("jpg".equals(extension) && !"jpg".equals(currentExtension) && !"jpeg".equals(currentExtension)) {
                return name.substring(0, dotIndex) + ".jpg";
            }
            return name;
        }
        return name + "." + extension;
    }
}
