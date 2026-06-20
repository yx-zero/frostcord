// Helpers for reading user-selected / pasted files into the shape the backend
// upload method expects (base64 data) plus a local preview URL.

export interface PendingFile {
  filename: string
  type: string // mime
  data: string // base64 (no data: prefix)
  previewUrl: string // object URL for local preview
}

export function readFile(file: File): Promise<PendingFile> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader()
    reader.onload = () => {
      const result = reader.result as string
      // result is a data URL: "data:<mime>;base64,<data>"
      const comma = result.indexOf(',')
      const data = comma >= 0 ? result.slice(comma + 1) : result
      resolve({
        filename: file.name || `pasted-${Date.now()}.png`,
        type: file.type || 'application/octet-stream',
        data,
        previewUrl: URL.createObjectURL(file),
      })
    }
    reader.onerror = () => reject(reader.error)
    reader.readAsDataURL(file)
  })
}

export function readFiles(files: FileList | File[]): Promise<PendingFile[]> {
  return Promise.all(Array.from(files).map(readFile))
}
