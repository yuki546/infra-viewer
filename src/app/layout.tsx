import React from "react";
import "./globals.css";

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="ja">
      <head>
        <link rel="stylesheet" href="/cesium/Widgets/widgets.css" />
        <script
          dangerouslySetInnerHTML={{
            __html: `window.CESIUM_BASE_URL="/cesium";`,
          }}
        />
      </head>
      <body className="min-h-screen bg-white text-slate-900">{children}</body>
    </html>
  );
}
