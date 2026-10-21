export function restrictWindowsDirectory(_dirPath: string): Promise<boolean> {
  return Promise.resolve(true)
}

export function restrictWindowsFile(_filePath: string): Promise<boolean> {
  return Promise.resolve(true)
}

export function restrictWindowsPathSync(_targetPath: string, _isDirectory: boolean): boolean {
  return true
}

export function writeRestrictedWindowsFile(
  _targetPath: string,
  _contents: string | Buffer
): boolean {
  return true
}
