"use client"
import dynamic from "next/dynamic"

const WatermarkPDF = dynamic(() => import("./watermarkpdf"), { ssr: false })
export default function Page() {
    return <WatermarkPDF />
}
