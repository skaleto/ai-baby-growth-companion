package com.xiaobao.growthcompanion;

import android.Manifest;
import android.content.Intent;
import android.content.pm.PackageManager;
import android.graphics.Color;
import android.media.Image;
import android.os.Bundle;
import android.view.Gravity;
import android.view.ViewGroup;
import android.widget.Button;
import android.widget.FrameLayout;
import android.widget.TextView;

import androidx.activity.result.ActivityResultLauncher;
import androidx.activity.result.contract.ActivityResultContracts;
import androidx.annotation.NonNull;
import androidx.appcompat.app.AppCompatActivity;
import androidx.camera.core.CameraSelector;
import androidx.camera.core.ExperimentalGetImage;
import androidx.camera.core.ImageAnalysis;
import androidx.camera.core.ImageProxy;
import androidx.camera.core.Preview;
import androidx.camera.lifecycle.ProcessCameraProvider;
import androidx.camera.view.PreviewView;
import androidx.core.content.ContextCompat;

import com.google.common.util.concurrent.ListenableFuture;
import com.google.mlkit.vision.barcode.BarcodeScannerOptions;
import com.google.mlkit.vision.barcode.BarcodeScanning;
import com.google.mlkit.vision.barcode.common.Barcode;
import com.google.mlkit.vision.common.InputImage;

import java.util.concurrent.ExecutorService;
import java.util.concurrent.Executors;
import java.util.concurrent.atomic.AtomicBoolean;

public class BarcodeScannerActivity extends AppCompatActivity {
    private final AtomicBoolean completed = new AtomicBoolean(false);
    private final AtomicBoolean processing = new AtomicBoolean(false);
    private final ActivityResultLauncher<String> permissionLauncher = registerForActivityResult(
            new ActivityResultContracts.RequestPermission(),
            granted -> {
                if (granted) startCamera();
                else finishCancelled();
            });
    private ExecutorService cameraExecutor;
    private com.google.mlkit.vision.barcode.BarcodeScanner mlKitScanner;
    private PreviewView previewView;

    @Override
    protected void onCreate(Bundle savedInstanceState) {
        super.onCreate(savedInstanceState);
        cameraExecutor = Executors.newSingleThreadExecutor();
        mlKitScanner = BarcodeScanning.getClient(new BarcodeScannerOptions.Builder()
                .setBarcodeFormats(
                        Barcode.FORMAT_EAN_13,
                        Barcode.FORMAT_EAN_8,
                        Barcode.FORMAT_UPC_A,
                        Barcode.FORMAT_UPC_E,
                        Barcode.FORMAT_CODE_128,
                        Barcode.FORMAT_CODE_39,
                        Barcode.FORMAT_ITF,
                        Barcode.FORMAT_QR_CODE)
                .build());
        setContentView(createContentView());

        if (ContextCompat.checkSelfPermission(this, Manifest.permission.CAMERA) == PackageManager.PERMISSION_GRANTED) {
            startCamera();
        } else {
            permissionLauncher.launch(Manifest.permission.CAMERA);
        }
    }

    @Override
    protected void onDestroy() {
        super.onDestroy();
        if (mlKitScanner != null) mlKitScanner.close();
        if (cameraExecutor != null) cameraExecutor.shutdown();
    }

    private FrameLayout createContentView() {
        FrameLayout root = new FrameLayout(this);
        root.setBackgroundColor(Color.BLACK);
        previewView = new PreviewView(this);
        previewView.setImplementationMode(PreviewView.ImplementationMode.COMPATIBLE);
        root.addView(previewView, new FrameLayout.LayoutParams(
                ViewGroup.LayoutParams.MATCH_PARENT,
                ViewGroup.LayoutParams.MATCH_PARENT));

        TextView hint = new TextView(this);
        hint.setText("对准商品条形码");
        hint.setTextColor(Color.WHITE);
        hint.setTextSize(17);
        hint.setGravity(Gravity.CENTER);
        hint.setBackgroundColor(0x66000000);
        FrameLayout.LayoutParams hintParams = new FrameLayout.LayoutParams(
                ViewGroup.LayoutParams.MATCH_PARENT,
                dp(64),
                Gravity.BOTTOM);
        hintParams.setMargins(dp(18), 0, dp(18), dp(82));
        root.addView(hint, hintParams);

        Button cancel = new Button(this);
        cancel.setText("取消");
        cancel.setTextColor(Color.WHITE);
        cancel.setBackgroundColor(0x33000000);
        cancel.setOnClickListener(view -> finishCancelled());
        FrameLayout.LayoutParams cancelParams = new FrameLayout.LayoutParams(dp(92), dp(48), Gravity.TOP | Gravity.END);
        cancelParams.setMargins(0, dp(28), dp(18), 0);
        root.addView(cancel, cancelParams);
        return root;
    }

    private void startCamera() {
        ListenableFuture<ProcessCameraProvider> cameraProviderFuture = ProcessCameraProvider.getInstance(this);
        cameraProviderFuture.addListener(() -> {
            try {
                ProcessCameraProvider cameraProvider = cameraProviderFuture.get();
                Preview preview = new Preview.Builder().build();
                preview.setSurfaceProvider(previewView.getSurfaceProvider());
                ImageAnalysis analysis = new ImageAnalysis.Builder()
                        .setBackpressureStrategy(ImageAnalysis.STRATEGY_KEEP_ONLY_LATEST)
                        .build();
                analysis.setAnalyzer(cameraExecutor, this::analyzeFrame);
                cameraProvider.unbindAll();
                cameraProvider.bindToLifecycle(this, CameraSelector.DEFAULT_BACK_CAMERA, preview, analysis);
            } catch (Exception ignored) {
                finishCancelled();
            }
        }, ContextCompat.getMainExecutor(this));
    }

    @ExperimentalGetImage
    private void analyzeFrame(@NonNull ImageProxy imageProxy) {
        if (completed.get()) {
            imageProxy.close();
            return;
        }
        if (!processing.compareAndSet(false, true)) {
            imageProxy.close();
            return;
        }
        Image mediaImage = imageProxy.getImage();
        if (mediaImage == null) {
            processing.set(false);
            imageProxy.close();
            return;
        }
        InputImage image = InputImage.fromMediaImage(mediaImage, imageProxy.getImageInfo().getRotationDegrees());
        mlKitScanner.process(image)
                .addOnSuccessListener(barcodes -> {
                    for (Barcode barcode : barcodes) {
                        String value = barcode.getRawValue();
                        if (value != null && !value.trim().isEmpty()) {
                            finishWithBarcode(value.trim(), barcode.getFormat());
                            break;
                        }
                    }
                })
                .addOnCompleteListener(task -> {
                    processing.set(false);
                    imageProxy.close();
                });
    }

    private void finishWithBarcode(String barcode, int format) {
        if (!completed.compareAndSet(false, true)) return;
        Intent data = new Intent();
        data.putExtra("barcode", barcode);
        data.putExtra("format", formatName(format));
        setResult(RESULT_OK, data);
        finish();
    }

    private void finishCancelled() {
        if (!completed.compareAndSet(false, true)) return;
        setResult(RESULT_CANCELED);
        finish();
    }

    private String formatName(int format) {
        return switch (format) {
            case Barcode.FORMAT_EAN_13 -> "EAN_13";
            case Barcode.FORMAT_EAN_8 -> "EAN_8";
            case Barcode.FORMAT_UPC_A -> "UPC_A";
            case Barcode.FORMAT_UPC_E -> "UPC_E";
            case Barcode.FORMAT_CODE_128 -> "CODE_128";
            case Barcode.FORMAT_CODE_39 -> "CODE_39";
            case Barcode.FORMAT_ITF -> "ITF";
            case Barcode.FORMAT_QR_CODE -> "QR_CODE";
            default -> "UNKNOWN";
        };
    }

    private int dp(int value) {
        return Math.round(value * getResources().getDisplayMetrics().density);
    }
}
