"use client"
import dynamic from "next/dynamic"

const AddPgNo = dynamic(() => import("./addpgno"), { ssr: false })

export default function Page() {
    return (
        <AddPgNo />
    )
}