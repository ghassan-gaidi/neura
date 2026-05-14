import { NextResponse } from 'next/server'
import fs from 'fs'
import path from 'path'

/**
 * GET /openapi.yaml
 * Serves the OpenAPI 3.1 spec for agent consumption and tooling.
 */
export async function GET() {
  try {
    const filePath = path.join(process.cwd(), 'docs', 'openapi.yaml')
    const content = fs.readFileSync(filePath, 'utf-8')

    return new NextResponse(content, {
      headers: {
        'Content-Type': 'text/yaml',
        'Content-Disposition': 'inline; filename="openapi.yaml"',
      },
    })
  } catch {
    return NextResponse.json(
      { error: { code: 'not_found', message: 'OpenAPI spec not found' } },
      { status: 404 }
    )
  }
}
