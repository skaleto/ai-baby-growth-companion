type FileWithCapturedAt = File & {
  capturedAt?: string;
};

const exifHeader = "Exif\0\0";
const tiffLittleEndian = 0x4949;
const tiffBigEndian = 0x4d4d;
const tiffMagic = 42;
const tagDateTime = 0x0132;
const tagExifIfdPointer = 0x8769;
const tagDateTimeOriginal = 0x9003;
const tagDateTimeDigitized = 0x9004;

const pad2 = (value: number) => `${value}`.padStart(2, "0");

const toLocalIsoSeconds = (date: Date) =>
  `${date.getFullYear()}-${pad2(date.getMonth() + 1)}-${pad2(date.getDate())}T${pad2(date.getHours())}:${pad2(date.getMinutes())}:${pad2(date.getSeconds())}`;

export const parseExifDateTimeText = (value?: string | null) => {
  const match = value?.trim().match(/^(\d{4}):(\d{2}):(\d{2})[ T](\d{2}):(\d{2}):(\d{2})/);
  if (!match) return undefined;
  const [, year, month, day, hour, minute, second] = match;
  const date = new Date(Number(year), Number(month) - 1, Number(day), Number(hour), Number(minute), Number(second));
  if (Number.isNaN(date.getTime())) return undefined;
  return `${year}-${month}-${day}T${hour}:${minute}:${second}`;
};

const stringAt = (view: DataView, offset: number, length: number) => {
  if (offset < 0 || length < 0 || offset + length > view.byteLength) return "";
  let result = "";
  for (let index = 0; index < length; index += 1) {
    result += String.fromCharCode(view.getUint8(offset + index));
  }
  return result;
};

const isJpegFile = (file: File) =>
  file.type === "image/jpeg" || file.type === "image/jpg" || /\.jpe?g$/i.test(file.name);

const readUint16 = (view: DataView, offset: number, littleEndian: boolean) =>
  offset + 2 <= view.byteLength ? view.getUint16(offset, littleEndian) : undefined;

const readUint32 = (view: DataView, offset: number, littleEndian: boolean) =>
  offset + 4 <= view.byteLength ? view.getUint32(offset, littleEndian) : undefined;

const valueOffsetForEntry = (
  view: DataView,
  tiffStart: number,
  entryOffset: number,
  count: number,
  littleEndian: boolean,
) => {
  if (count <= 4) return entryOffset + 8;
  const relative = readUint32(view, entryOffset + 8, littleEndian);
  return relative === undefined ? undefined : tiffStart + relative;
};

const readAsciiTag = (
  view: DataView,
  tiffStart: number,
  ifdOffset: number,
  tag: number,
  littleEndian: boolean,
) => {
  const entryCount = readUint16(view, ifdOffset, littleEndian);
  if (entryCount === undefined) return undefined;
  for (let index = 0; index < entryCount; index += 1) {
    const entryOffset = ifdOffset + 2 + index * 12;
    if (entryOffset + 12 > view.byteLength) return undefined;
    if (readUint16(view, entryOffset, littleEndian) !== tag) continue;
    const type = readUint16(view, entryOffset + 2, littleEndian);
    const count = readUint32(view, entryOffset + 4, littleEndian);
    if (type !== 2 || count === undefined || count <= 1) return undefined;
    const valueOffset = valueOffsetForEntry(view, tiffStart, entryOffset, count, littleEndian);
    if (valueOffset === undefined || valueOffset < 0 || valueOffset + count > view.byteLength) return undefined;
    return stringAt(view, valueOffset, count).replace(/\0+$/, "");
  }
  return undefined;
};

const readLongTag = (
  view: DataView,
  tiffStart: number,
  ifdOffset: number,
  tag: number,
  littleEndian: boolean,
) => {
  const entryCount = readUint16(view, ifdOffset, littleEndian);
  if (entryCount === undefined) return undefined;
  for (let index = 0; index < entryCount; index += 1) {
    const entryOffset = ifdOffset + 2 + index * 12;
    if (entryOffset + 12 > view.byteLength) return undefined;
    if (readUint16(view, entryOffset, littleEndian) !== tag) continue;
    const type = readUint16(view, entryOffset + 2, littleEndian);
    const count = readUint32(view, entryOffset + 4, littleEndian);
    if (type !== 4 || count !== 1) return undefined;
    const relative = readUint32(view, entryOffset + 8, littleEndian);
    return relative === undefined ? undefined : tiffStart + relative;
  }
  return undefined;
};

const parseExifTiffDate = (view: DataView, tiffStart: number) => {
  const byteOrder = readUint16(view, tiffStart, false);
  const littleEndian = byteOrder === tiffLittleEndian;
  if (!littleEndian && byteOrder !== tiffBigEndian) return undefined;
  if (readUint16(view, tiffStart + 2, littleEndian) !== tiffMagic) return undefined;
  const ifd0RelativeOffset = readUint32(view, tiffStart + 4, littleEndian);
  if (ifd0RelativeOffset === undefined) return undefined;
  const ifd0Offset = tiffStart + ifd0RelativeOffset;
  if (ifd0Offset < 0 || ifd0Offset >= view.byteLength) return undefined;

  const exifIfdOffset = readLongTag(view, tiffStart, ifd0Offset, tagExifIfdPointer, littleEndian);
  const exifDate =
    exifIfdOffset !== undefined
      ? readAsciiTag(view, tiffStart, exifIfdOffset, tagDateTimeOriginal, littleEndian) ??
        readAsciiTag(view, tiffStart, exifIfdOffset, tagDateTimeDigitized, littleEndian)
      : undefined;
  return parseExifDateTimeText(exifDate ?? readAsciiTag(view, tiffStart, ifd0Offset, tagDateTime, littleEndian));
};

export const readExifCaptureDate = async (file: File) => {
  if (!isJpegFile(file) || file.size < 16) return undefined;
  const buffer = await file.slice(0, Math.min(file.size, 1024 * 1024)).arrayBuffer();
  const view = new DataView(buffer);
  if (readUint16(view, 0, false) !== 0xffd8) return undefined;

  let offset = 2;
  while (offset + 4 <= view.byteLength) {
    if (view.getUint8(offset) !== 0xff) break;
    const marker = view.getUint8(offset + 1);
    offset += 2;
    if (marker === 0xda || marker === 0xd9) break;
    const segmentLength = readUint16(view, offset, false);
    if (segmentLength === undefined || segmentLength < 2) break;
    const segmentStart = offset + 2;
    const segmentEnd = offset + segmentLength;
    if (segmentEnd > view.byteLength) break;
    if (marker === 0xe1 && stringAt(view, segmentStart, exifHeader.length) === exifHeader) {
      return parseExifTiffDate(view, segmentStart + exifHeader.length);
    }
    offset = segmentEnd;
  }

  return undefined;
};

const fileLastModifiedDate = (file: File) => {
  if (!Number.isFinite(file.lastModified) || file.lastModified <= 0) return undefined;
  const date = new Date(file.lastModified);
  return Number.isNaN(date.getTime()) ? undefined : toLocalIsoSeconds(date);
};

export const resolveMediaCaptureDate = async (file: File, uploadCreatedAt?: string) => {
  const nativeCapturedAt = (file as FileWithCapturedAt).capturedAt;
  if (nativeCapturedAt) return nativeCapturedAt;
  const exifDate = await readExifCaptureDate(file).catch(() => undefined);
  return exifDate ?? fileLastModifiedDate(file) ?? uploadCreatedAt ?? new Date().toISOString();
};
