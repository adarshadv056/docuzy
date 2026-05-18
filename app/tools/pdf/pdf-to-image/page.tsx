"use client";
import dynamic from 'next/dynamic';

const PdfToJpg = dynamic(() => import('./pdf-to-image'), { 
  ssr: false,
});

export default function Page() {
  return <PdfToJpg />;
}