import { NextRequest, NextResponse } from 'next/server'
import { PDFDocument } from 'pdf-lib'

export async function POST(req: NextRequest) {
    try {
        const formData = await req.formData()
        const file = formData.get('file')
        const level = String(formData.get('level') || 'medium')

        if (!(file instanceof File)) {
            return NextResponse.json({ error: 'No PDF file provided' }, { status: 400 })
        }

        if (file.type !== 'application/pdf') {
            return NextResponse.json({ error: 'Only PDF files are allowed' }, { status: 400 })
        }

        const inputBytes = await file.arrayBuffer()
        const pdfDoc = await PDFDocument.load(inputBytes)

        // pdf-lib does not truly recompress images in a PDF.
        // This route mainly rewrites/optimizes the PDF structure.
        // You can still use the level value later if you add a stronger compressor.
        const compressedBytes = await pdfDoc.save({
            useObjectStreams: true,
            addDefaultPage: false,
        })

        const filename = file.name.replace(/\.pdf$/i, '') || 'compressed'
        const body = Buffer.from(compressedBytes)

        return new NextResponse(body, {
            status: 200,
            headers: {
                'Content-Type': 'application/pdf',
                'Content-Disposition': `attachment; filename="${filename}-${level}.pdf"`,
            },
        })
    } catch (error) {
        console.error('Compression error:', error)
        return NextResponse.json(
            { error: 'Failed to compress PDF' },
            { status: 500 }
        )
    }
}