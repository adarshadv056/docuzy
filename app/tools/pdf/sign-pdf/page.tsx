"use client";
import dynamic from 'next/dynamic';

const SignPdf = dynamic(() => import('./sign-pdf'), { 
  ssr: false,
});

export default function Page() {
  return <SignPdf />;
}