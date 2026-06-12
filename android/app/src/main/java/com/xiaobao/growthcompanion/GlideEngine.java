package com.xiaobao.growthcompanion;

import android.content.Context;
import android.widget.ImageView;

import com.bumptech.glide.Glide;
import com.luck.picture.lib.engine.ImageEngine;
import com.luck.picture.lib.utils.ActivityCompatHelper;

/**
 * PictureSelector 的图片加载引擎(官方推荐的 Glide 接法,精简版)。
 */
public final class GlideEngine implements ImageEngine {

    private GlideEngine() {
    }

    private static final class Holder {
        private static final GlideEngine INSTANCE = new GlideEngine();
    }

    public static GlideEngine createGlideEngine() {
        return Holder.INSTANCE;
    }

    @Override
    public void loadImage(Context context, String url, ImageView imageView) {
        if (!ActivityCompatHelper.assertValidRequest(context)) return;
        Glide.with(context).load(url).into(imageView);
    }

    @Override
    public void loadImage(Context context, ImageView imageView, String url, int maxWidth, int maxHeight) {
        if (!ActivityCompatHelper.assertValidRequest(context)) return;
        Glide.with(context).load(url).override(maxWidth, maxHeight).into(imageView);
    }

    @Override
    public void loadAlbumCover(Context context, String url, ImageView imageView) {
        if (!ActivityCompatHelper.assertValidRequest(context)) return;
        Glide.with(context).asBitmap().load(url).override(180, 180).centerCrop().into(imageView);
    }

    @Override
    public void loadGridImage(Context context, String url, ImageView imageView) {
        if (!ActivityCompatHelper.assertValidRequest(context)) return;
        Glide.with(context).load(url).override(270, 270).centerCrop().into(imageView);
    }

    @Override
    public void pauseRequests(Context context) {
        if (!ActivityCompatHelper.assertValidRequest(context)) return;
        Glide.with(context).pauseRequests();
    }

    @Override
    public void resumeRequests(Context context) {
        if (!ActivityCompatHelper.assertValidRequest(context)) return;
        Glide.with(context).resumeRequests();
    }
}
