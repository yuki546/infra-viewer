"use client";

import React, { useEffect, useRef, useState } from "react";
import { Viewer as ResiumViewer } from "resium";
import {
  Ion,
  IonResource,
  Cartesian3,
  EllipsoidTerrainProvider,
  GeoJsonDataSource,
  Color,
  ScreenSpaceEventHandler,
  ScreenSpaceEventType,
  defined,
  Viewer as CesiumViewerType,
  Cesium3DTileset,
  ConstantProperty,
  PointGraphics,
  JulianDate,
  createWorldImageryAsync,
  IonWorldImageryStyle,
  HeightReference,
} from "cesium";
import { useAppStore } from "@/lib/store";

// Ion トークン設定（.env から）
Ion.defaultAccessToken = process.env.NEXT_PUBLIC_CESIUM_ION_TOKEN || "";

export default function CesiumViewer() {
  const { setSelectedFeature, searchText, filters } = useAppStore();

  const viewerRef = useRef<CesiumViewerType | null>(null);
  const [viewerReady, setViewerReady] = useState(false);
  const geojsonRef = useRef<GeoJsonDataSource | null>(null);

  // --- 経度/緯度/高さ 入力UI（東京を初期値） ---
  const [lonInput, setLonInput] = useState<string>("139.6917");
  const [latInput, setLatInput] = useState<string>("35.6895");
  const [heightInput, setHeightInput] = useState<string>("3000");
  const [gotoError, setGotoError] = useState<string>("");

  // assetId を厳密に解釈（不正なら undefined）
  const rawAssetId = (process.env.NEXT_PUBLIC_ION_ASSET_ID || "").trim();
  const parsed = Number.parseInt(rawAssetId, 10);
  const ionAssetId = Number.isFinite(parsed) ? parsed : undefined;

  // --- Viewer 準備後の初期化（最小限） ---
  useEffect(() => {
    if (!viewerReady) return;
    const v = viewerRef.current!;
    // 画像レイヤは一旦クリア
    v.imageryLayers.removeAll();
    // 地形は楕円体（無料）
    v.terrainProvider = new EllipsoidTerrainProvider();

    const tokyoLon = 139.6917;
    const tokyoLat = 35.6895;
    const initialHeight = 20000000;

    // 高解像度の世界画像（Ion）— 見栄え向上。不要なら try 内を削除
    (async () => {
      try {
        const provider = await createWorldImageryAsync({
          style: IonWorldImageryStyle.AERIAL_WITH_LABELS,
        });
        v.imageryLayers.addImageryProvider(provider);
      } catch (e) {
        console.error("[Imagery] ion world imagery error:", e);
      } finally {
        v.camera.setView({
          destination: Cartesian3.fromDegrees(
            tokyoLon,
            tokyoLat,
            initialHeight
          ),
          orientation: {
            heading: 0,
            pitch: -Math.PI / 2,
            roll: 0,
          },
        });
        v.scene.requestRender();
      }
    })();

    // Home ボタンを東京へ飛ばすように差し替え
    const removeHomeHandler =
      v.homeButton.viewModel.command.beforeExecute.addEventListener((e) => {
        e.cancel = true; // 規定の「世界矩形へ戻る」をキャンセル
        v.camera.flyTo({
          destination: Cartesian3.fromDegrees(
            tokyoLon,
            tokyoLat,
            initialHeight
          ),
          orientation: {
            heading: 0,
            pitch: -Math.PI / 2,
            roll: 0,
          },
        });
      });

    // レイアウト確定やウィンドウリサイズ時はホームへ（中央ズレ対策）
    const id = setTimeout(() => {
      v.resize();
      v.scene.requestRender();
    }, 0);
    const onResize = () => {
      v.resize();
      v.scene.requestRender();
    };
    window.addEventListener("resize", onResize);

    // デバッグ
    console.log("[Cesium] BASE_URL =", (window as any).CESIUM_BASE_URL);
    console.log("[Cesium] Ion token set?", !!Ion.defaultAccessToken);
    console.log("[Cesium] Ion assetId =", ionAssetId);

    return () => {
      clearTimeout(id);
      window.removeEventListener("resize", onResize);
      // リスナー解除
      removeHomeHandler?.();
    };
  }, [viewerReady, ionAssetId]);

  // --- GeoJSON 読み込み（カメラ移動はしない） ---
  useEffect(() => {
    if (!viewerReady) return;
    const v = viewerRef.current!;
    (async () => {
      try {
        v.dataSources.removeAll();
        geojsonRef.current = null;

        const srcPath = "/data/targets.kochi.geojson";
        console.log("[GeoJSON] loading:", srcPath);

        const ds = await GeoJsonDataSource.load(srcPath, {
          clampToGround: false,
        });
        if (!v || v.isDestroyed()) return;

        v.dataSources.add(ds);
        geojsonRef.current = ds;

        const entities = ds.entities.values;
        console.log("[GeoJSON] entities:", entities.length);

        // PointGraphics に統一（見えやすく・手前に描く）
        for (const e of entities) {
          (e as any).billboard = undefined;
          e.point = new PointGraphics({
            color: new ConstantProperty(Color.YELLOW),
            pixelSize: new ConstantProperty(18),
            outlineColor: new ConstantProperty(Color.BLACK),
            outlineWidth: new ConstantProperty(2),
            heightReference: HeightReference.NONE,
            disableDepthTestDistance: Number.POSITIVE_INFINITY,
          });
        }

        v.scene.requestRender();
      } catch (err) {
        console.error("[GeoJSON] load error:", err);
      }
    })();
  }, [viewerReady]);

  // --- フィルタ／検索（描画のみ） ---
  useEffect(() => {
    const ds = geojsonRef.current;
    if (!ds) return;
    const entities = ds.entities.values;
    const text = searchText.trim().toLowerCase();
    const fTypes = new Set(filters.types);
    const fStatus = new Set(filters.status);

    for (const e of entities) {
      const props: any = e.properties || {};
      const name = (
        props.name?.getValue?.(JulianDate.now()) || ""
      ).toLowerCase();
      const type = props.type?.getValue?.(JulianDate.now()) || "";
      const status = props.status?.getValue?.(JulianDate.now()) || "";
      const matchText = !text || name.includes(text);
      const matchType = fTypes.size === 0 || fTypes.has(type);
      const matchStatus = fStatus.size === 0 || fStatus.has(status);
      (e as any).show = matchText && matchType && matchStatus;
    }
    viewerRef.current?.scene.requestRender();
  }, [searchText, filters]);

  // --- クリック→右パネル更新 ---
  useEffect(() => {
    if (!viewerReady) return;
    const v = viewerRef.current!;
    const handler = new ScreenSpaceEventHandler(v.scene.canvas);
    handler.setInputAction(
      (click: import("cesium").ScreenSpaceEventHandler.PositionedEvent) => {
        const picked = v.scene.pick(click.position);
        if (defined(picked) && (picked as any).id) {
          const ent: any = (picked as any).id;
          const props = ent.properties?.getValue?.(JulianDate.now()) || {};
          setSelectedFeature({ id: ent.id, properties: props });
        } else {
          setSelectedFeature(null);
        }
      },
      ScreenSpaceEventType.LEFT_CLICK
    );
    return () => handler.destroy();
  }, [viewerReady, setSelectedFeature]);

  // --- Tileset（ion）追加のみ（カメラ移動はしない） ---
  useEffect(() => {
    if (!viewerReady) return;
    const v = viewerRef.current!;
    if (!ionAssetId) {
      console.log("[Tileset] skipped (no assetId).");
      return;
    }

    let disposed = false;
    let tileset: Cesium3DTileset | undefined;

    (async () => {
      try {
        console.log("[Tileset] loading assetId=", ionAssetId);
        const resource = await IonResource.fromAssetId(ionAssetId);
        const ts = await Cesium3DTileset.fromUrl(resource);
        if (disposed || !v || v.isDestroyed()) return;

        tileset = ts;
        v.scene.primitives.add(ts);
        v.scene.requestRender();
      } catch (e) {
        console.error("[Tileset] load error:", e);
      }
    })();

    return () => {
      disposed = true;
      if (tileset && !tileset.isDestroyed?.()) {
        v.scene.primitives.remove(tileset);
        tileset.destroy?.();
      }
    };
  }, [viewerReady, ionAssetId]);

  // --- 経度/緯度/高さ 入力 → flyTo ---
  const handleFlyTo = (e?: React.FormEvent) => {
    e?.preventDefault();
    setGotoError("");
    const lon = Number.parseFloat(lonInput);
    const lat = Number.parseFloat(latInput);
    const height = Number.parseFloat(heightInput);

    if (!Number.isFinite(lon) || lon < -180 || lon > 180) {
      setGotoError("経度は -180 ~ 180 の数値で入力してください。");
      return;
    }
    if (!Number.isFinite(lat) || lat < -90 || lat > 90) {
      setGotoError("緯度は -90 ~ 90 の数値で入力してください。");
      return;
    }
    if (!Number.isFinite(height) || height <= 0) {
      setGotoError("高さは 0 より大きい数値(メートル）で入力してください。");
      return;
    }

    const v = viewerRef.current;
    if (!v) return;
    v.camera.flyTo({
      destination: Cartesian3.fromDegrees(lon, lat, height),
      orientation: { heading: 0, pitch: -Math.PI / 2, roll: 0 },
      duration: 0.8,
    });
  };

  return (
    <div className="relative flex-1 min-h-[600px] overflow-hidden">
      {/* 入力フォーム（オーバーレイ） */}
      <form
        onSubmit={handleFlyTo}
        className="absolute z-10 left-3 top-3 rounded-xl bg-white/80 backdrop-blur px-3 py-2 shadow-md flex items-end gap-2"
      >
        <div className="flex flex-col text-sm">
          <label className="font-medium">経度 (lon)</label>
          <input
            className="border rounded px-2 py-1 w-[120px]"
            value={lonInput}
            onChange={(e) => setLonInput(e.target.value)}
            placeholder="139.6917"
            inputMode="decimal"
          />
        </div>
        <div className="flex flex-col text-sm">
          <label className="font-medium">緯度 (lat)</label>
          <input
            className="border rounded px-2 py-1 w-[120px]"
            value={latInput}
            onChange={(e) => setLatInput(e.target.value)}
            placeholder="35.6895"
            inputMode="decimal"
          />
        </div>
        <div className="flex flex-col text-sm">
          <label className="font-medium">高さ (m)</label>
          <input
            className="border rounded px-2 py-1 w-[120px]"
            value={heightInput}
            onChange={(e) => setHeightInput(e.target.value)}
            placeholder="3000"
            inputMode="numeric"
          />
        </div>
        <button
          type="submit"
          className="h-[34px] px-3 rounded bg-blue-600 text-white text-sm font-semibold hover:bg-blue-700"
        >
          移動
        </button>
        {gotoError && (
          <span className="ml-2 text-xs text-red-600">{gotoError}</span>
        )}
      </form>

      <ResiumViewer
        ref={(r) => {
          viewerRef.current = (r as any)?.cesiumElement || null;
          setViewerReady(!!viewerRef.current);
        }}
        className="h-full w-full"
        // ★ Home ボタンを出して「いつでも初期位置へ」戻れるように
        homeButton={true}
        animation={true}
        timeline={true}
        baseLayerPicker={true}
        geocoder={true}
        sceneModePicker={true}
        navigationHelpButton={true}
        fullscreenButton={true}
        selectionIndicator={true}
      />
    </div>
  );
}
