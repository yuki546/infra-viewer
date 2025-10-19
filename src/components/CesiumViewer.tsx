"use client";

import { useEffect, useRef, useState } from "react";
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
        // ★ 初期はホームビュー（デフォルト）に戻す
        v.camera.flyHome(0);
        v.scene.requestRender();
      }
    })();

    // レイアウト確定やウィンドウリサイズ時はホームへ（中央ズレ対策）
    const id = setTimeout(() => {
      v.resize();
      v.camera.flyHome(0);
      v.scene.requestRender();
    }, 0);
    const onResize = () => {
      v.resize();
      v.camera.flyHome(0);
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

  return (
    <div className="flex-1 min-h-[600px] overflow-hidden">
      <ResiumViewer
        ref={(r) => {
          viewerRef.current = (r as any)?.cesiumElement || null;
          setViewerReady(!!viewerRef.current);
        }}
        className="h-full w-full"
        // ★ Home ボタンを出して「いつでも初期位置へ」戻れるように
        homeButton={true}
        animation={false}
        timeline={false}
        baseLayerPicker={false}
        geocoder={false}
        sceneModePicker={false}
        navigationHelpButton={false}
        fullscreenButton={false}
        selectionIndicator={false}
      />
    </div>
  );
}
