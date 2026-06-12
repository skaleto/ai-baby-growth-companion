package com.xiaobao.growthcompanion;

import android.content.ContentResolver;
import android.database.Cursor;
import android.graphics.Bitmap;
import android.graphics.BitmapFactory;
import android.net.Uri;
import android.provider.MediaStore;
import android.provider.OpenableColumns;
import android.webkit.MimeTypeMap;

import com.getcapacitor.JSArray;
import com.getcapacitor.JSObject;
import com.getcapacitor.Plugin;
import com.getcapacitor.PluginCall;
import com.getcapacitor.PluginMethod;
import com.getcapacitor.annotation.CapacitorPlugin;
import com.luck.picture.lib.basic.PictureSelector;
import com.luck.picture.lib.config.SelectMimeType;
import com.luck.picture.lib.config.SelectModeConfig;
import com.luck.picture.lib.entity.LocalMedia;
import com.luck.picture.lib.interfaces.OnResultCallbackListener;
import com.luck.picture.lib.language.LanguageConfig;

import java.io.File;
import java.io.FileOutputStream;
import java.io.InputStream;
import java.text.SimpleDateFormat;
import java.util.ArrayList;
import java.util.Date;
import java.util.Locale;
import java.util.UUID;

/**
 * 相册选择(5.3 选型,2026-06-12):Android 改走 PictureSelector 自带相册 UI——
 * 华为/鸿蒙无 GMS,系统 ACTION_PICK_IMAGES 解析不到 Activity,旧实现永远落到
 * ACTION_OPEN_DOCUMENT(系统文件管理器,丑且交互差)。PictureSelector 自带完整
 * 相册界面(图+视频混选/预览/张数角标),不依赖任何系统选择器组件。
 * 返回形状与旧实现完全一致(uri/name/mimeType/kind/size/width/height/durationMs/capturedAt),
 * Web 侧零改动;iOS 端(PHPicker)保持现状。
 */
@CapacitorPlugin(name = "NativeMediaPicker")
public class NativeMediaPickerPlugin extends Plugin {
    private static final int MAX_SELECTION_LIMIT = 50;

    @PluginMethod
    public void pickMedia(PluginCall call) {
        final int limit = Math.max(1, Math.min(call.getInt("limit", 1), MAX_SELECTION_LIMIT));
        try {
            PictureSelector.create(getActivity())
                .openGallery(SelectMimeType.ofAll())
                .setImageEngine(GlideEngine.createGlideEngine())
                .setSelectionMode(limit > 1 ? SelectModeConfig.MULTIPLE : SelectModeConfig.SINGLE)
                .setMaxSelectNum(limit)
                .setMaxVideoSelectNum(limit)
                .isWithSelectVideoImage(true)
                .setLanguage(LanguageConfig.CHINESE)
                .isDisplayCamera(false)
                .isGif(true)
                .forResult(new OnResultCallbackListener<LocalMedia>() {
                    @Override
                    public void onResult(ArrayList<LocalMedia> result) {
                        resolveSelection(call, result);
                    }

                    @Override
                    public void onCancel() {
                        JSObject response = new JSObject();
                        response.put("items", new JSArray());
                        call.resolve(response);
                    }
                });
        } catch (Exception error) {
            call.reject("Unable to open media picker", error);
        }
    }

    /** 复制/归一化在后台线程做(大视频拷贝不卡选择器收尾动画)。 */
    private void resolveSelection(PluginCall call, ArrayList<LocalMedia> selection) {
        new Thread(() -> {
            JSArray items = new JSArray();
            try {
                if (selection != null) {
                    for (LocalMedia media : selection) {
                        if (media == null) continue;
                        JSObject item = copyLocalMedia(media);
                        if (item != null) items.put(item);
                    }
                }
            } catch (Exception error) {
                call.reject("Failed to read selected media", error);
                return;
            }
            JSObject response = new JSObject();
            response.put("items", items);
            call.resolve(response);
        }, "native-media-picker-copy").start();
    }

    private Uri uriFor(LocalMedia media) {
        String path = media.getAvailablePath();
        if (path == null || path.trim().isEmpty()) path = media.getPath();
        if (path == null || path.trim().isEmpty()) return null;
        if (path.startsWith("content://") || path.startsWith("file://")) return Uri.parse(path);
        return Uri.fromFile(new File(path));
    }

    private JSObject copyLocalMedia(LocalMedia media) throws Exception {
        Uri sourceUri = uriFor(media);
        if (sourceUri == null) return null;

        String mimeType = media.getMimeType();
        if (mimeType == null || mimeType.trim().isEmpty()) {
            mimeType = getContext().getContentResolver().getType(sourceUri);
        }
        if (mimeType == null || (!mimeType.startsWith("image/") && !mimeType.startsWith("video/"))) {
            return null;
        }

        String displayName = media.getFileName();
        if (displayName == null || displayName.trim().isEmpty()) {
            displayName = displayName(sourceUri);
        }

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

        ContentResolver resolver = getContext().getContentResolver();
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
        boolean isVideo = mimeType.startsWith("video/");
        item.put("kind", isVideo ? "video" : "image");
        item.put("size", destination.length());
        if (media.getWidth() > 0) item.put("width", media.getWidth());
        if (media.getHeight() > 0) item.put("height", media.getHeight());
        if (isVideo && media.getDuration() > 0) item.put("durationMs", media.getDuration());

        String capturedAt = captureDate(sourceUri);
        if (capturedAt == null && media.getDateAddedTime() > 0) {
            capturedAt = localIsoString(media.getDateAddedTime() * 1000L);
        }
        if (capturedAt != null) {
            item.put("capturedAt", capturedAt);
        }
        return item;
    }

    private String captureDate(Uri uri) {
        if (!"content".equals(uri.getScheme())) return null;
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
            // Some providers do not expose media timestamps.
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
        if (!"content".equals(uri.getScheme())) {
            String last = uri.getLastPathSegment();
            return last == null || last.trim().isEmpty() ? "media" : last.trim();
        }
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
