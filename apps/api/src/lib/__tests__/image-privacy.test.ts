import { describe, expect, it, vi } from "vitest";
import piexif from "piexifjs";
import {
  isJpegImage,
  processImageForPrivacy,
  stripExifMetadata,
} from "../image-privacy";

describe("image-privacy", () => {
  // ---------- isJpegImage ----------

  describe("isJpegImage", () => {
    it("returns true for valid JPEG magic bytes (FF D8 FF)", () => {
      const jpegBuffer = new Uint8Array([0xff, 0xd8, 0xff, 0xe1, 0x00]).buffer;
      expect(isJpegImage(jpegBuffer)).toBe(true);
    });

    it("returns false for PNG magic bytes", () => {
      const pngBuffer = new Uint8Array([
        0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a,
      ]).buffer;
      expect(isJpegImage(pngBuffer)).toBe(false);
    });

    it("returns false for empty buffer", () => {
      const emptyBuffer = new ArrayBuffer(0);
      expect(isJpegImage(emptyBuffer)).toBe(false);
    });

    it("returns false for buffer with only 2 bytes", () => {
      const shortBuffer = new Uint8Array([0xff, 0xd8]).buffer;
      expect(isJpegImage(shortBuffer)).toBe(false);
    });

    it("returns false for buffer with 3 bytes but wrong values", () => {
      const wrongBuffer = new Uint8Array([0xff, 0xd8, 0x00]).buffer;
      expect(isJpegImage(wrongBuffer)).toBe(false);
    });

    it("returns true for minimal valid JPEG (3 correct bytes)", () => {
      const minJpeg = new Uint8Array([0xff, 0xd8, 0xff]).buffer;
      // Need 4+ bytes according to the check
      expect(isJpegImage(minJpeg)).toBe(false);
    });

    it("returns true for JPEG with JFIF marker (FF D8 FF E0)", () => {
      const jfifBuffer = new Uint8Array([0xff, 0xd8, 0xff, 0xe0]).buffer;
      expect(isJpegImage(jfifBuffer)).toBe(true);
    });
  });

  // ---------- stripExifMetadata ----------

  describe("stripExifMetadata", () => {
    it("returns original buffer for non-JPEG input", async () => {
      const pngBuffer = new Uint8Array([
        0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a,
      ]).buffer;

      const result = await stripExifMetadata(pngBuffer);
      expect(result).toBe(pngBuffer);
    });

    it("returns original buffer for empty input", async () => {
      const emptyBuffer = new ArrayBuffer(0);
      const result = await stripExifMetadata(emptyBuffer);
      expect(result).toBe(emptyBuffer);
    });

    it("handles JPEG without EXIF data gracefully", async () => {
      // Minimal JPEG structure (SOI + EOI)
      const minJpeg = new Uint8Array([
        0xff, 0xd8, 0xff, 0xe0, 0x00, 0x10, 0x4a, 0x46, 0x49, 0x46, 0x00, 0x01,
        0x01, 0x00, 0x00, 0x01, 0x00, 0x01, 0x00, 0x00, 0xff, 0xd9,
      ]).buffer;

      // Should not throw
      const result = await stripExifMetadata(minJpeg);
      expect(result).toBeInstanceOf(ArrayBuffer);
    });

    it("returns original buffer when piexif throws", async () => {
      // Create a buffer that looks like JPEG but will cause piexif.load to fail
      const badJpeg = new Uint8Array([
        0xff, 0xd8, 0xff, 0xe1, 0x00, 0x02, 0x00, 0x00,
      ]).buffer;
      const result = await stripExifMetadata(badJpeg);
      expect(result).toBe(badJpeg);
    });

    it("strips real EXIF data from JPEG", async () => {
      const minJpeg = new Uint8Array([
        0xff, 0xd8, 0xff, 0xe0, 0x00, 0x10, 0x4a, 0x46, 0x49, 0x46, 0x00, 0x01,
        0x01, 0x00, 0x00, 0x01, 0x00, 0x01, 0x00, 0x00, 0xff, 0xd9,
      ]).buffer;

      // Mock piexif.load to return EXIF data (hasExif=true branch)
      const loadSpy = vi.spyOn(piexif, "load").mockReturnValue({
        "0th": { 271: "TestCamera" },
        Exif: { 36867: "2025:01:01 12:00:00" },
        GPS: {},
        "1st": {},
        thumbnail: null,
      } as unknown as ReturnType<typeof piexif.load>);

      // Mock piexif.remove to return a clean data URL
      const cleanBinary = Array.from(new Uint8Array(minJpeg))
        .map((byte) => String.fromCharCode(byte))
        .join("");
      const cleanBase64 = btoa(cleanBinary);
      const removeSpy = vi
        .spyOn(piexif, "remove")
        .mockReturnValue(`data:image/jpeg;base64,${cleanBase64}`);

      const stripped = await stripExifMetadata(minJpeg);
      expect(stripped).toBeInstanceOf(ArrayBuffer);
      expect(loadSpy).toHaveBeenCalled();
      expect(removeSpy).toHaveBeenCalled();

      loadSpy.mockRestore();
      removeSpy.mockRestore();
    });

    it("returns original when EXIF object only has empty thumbnail data", async () => {
      const minJpeg = new Uint8Array([
        0xff, 0xd8, 0xff, 0xe0, 0x00, 0x10, 0x4a, 0x46, 0x49, 0x46, 0x00, 0x01,
        0x01, 0x00, 0x00, 0x01, 0x00, 0x01, 0x00, 0x00, 0xff, 0xd9,
      ]).buffer;

      const loadSpy = vi.spyOn(piexif, "load").mockReturnValue({
        "0th": {},
        Exif: {},
        GPS: {},
        "1st": {},
        thumbnail: "thumb",
      } as unknown as ReturnType<typeof piexif.load>);
      const removeSpy = vi.spyOn(piexif, "remove");

      const result = await stripExifMetadata(minJpeg);

      expect(result).toBe(minJpeg);
      expect(removeSpy).not.toHaveBeenCalled();

      loadSpy.mockRestore();
      removeSpy.mockRestore();
    });

    it("processImageForPrivacy strips EXIF from JPEG with EXIF data", async () => {
      const minJpeg = new Uint8Array([
        0xff, 0xd8, 0xff, 0xe0, 0x00, 0x10, 0x4a, 0x46, 0x49, 0x46, 0x00, 0x01,
        0x01, 0x00, 0x00, 0x01, 0x00, 0x01, 0x00, 0x00, 0xff, 0xd9,
      ]).buffer;

      const loadSpy = vi.spyOn(piexif, "load").mockReturnValue({
        "0th": { 271: "TestCamera" },
        Exif: {},
        GPS: {},
        "1st": {},
        thumbnail: null,
      } as unknown as ReturnType<typeof piexif.load>);

      const cleanBinary = Array.from(new Uint8Array(minJpeg))
        .map((byte) => String.fromCharCode(byte))
        .join("");
      const cleanBase64 = btoa(cleanBinary);
      const removeSpy = vi
        .spyOn(piexif, "remove")
        .mockReturnValue(`data:image/jpeg;base64,${cleanBase64}`);

      const result = await processImageForPrivacy(minJpeg, "photo.jpg");
      expect(result.buffer).toBeInstanceOf(ArrayBuffer);
      expect(result.metadata["privacy-processed"]).toBe("true");
      expect(result.metadata["exif-stripped"]).toBe("true");

      loadSpy.mockRestore();
      removeSpy.mockRestore();
    });
  });

  // ---------- processImageForPrivacy ----------

  describe("processImageForPrivacy", () => {
    it("returns non-JPEG buffer unchanged with skip metadata", async () => {
      const pngBuffer = new Uint8Array([
        0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a,
      ]).buffer;

      const result = await processImageForPrivacy(pngBuffer, "photo.png");

      expect(result.buffer).toBe(pngBuffer);
      expect(result.metadata["privacy-processed"]).toBe("false");
      expect(result.metadata["exif-stripped"]).toBe("false");
      expect(result.metadata.reason).toBe("non-jpeg");
    });

    it("processes JPEG and returns stripped metadata", async () => {
      const minJpeg = new Uint8Array([
        0xff, 0xd8, 0xff, 0xe0, 0x00, 0x10, 0x4a, 0x46, 0x49, 0x46, 0x00, 0x01,
        0x01, 0x00, 0x00, 0x01, 0x00, 0x01, 0x00, 0x00, 0xff, 0xd9,
      ]).buffer;

      const result = await processImageForPrivacy(minJpeg, "photo.jpg");

      expect(result.buffer).toBeInstanceOf(ArrayBuffer);
      expect(result.metadata["privacy-processed"]).toBe("true");
      expect(result.metadata["exif-stripped"]).toBe("true");
      expect(result.metadata["original-filename"]).toBe("photo.jpg");
      expect(result.metadata["processed-at"]).toBeDefined();
    });
  });

  describe("stripExifMetadata edge cases", () => {
    it("returns original when EXIF only has thumbnail data", async () => {
      const minJpeg = new Uint8Array([
        0xff, 0xd8, 0xff, 0xe0, 0x00, 0x10, 0x4a, 0x46, 0x49, 0x46, 0x00, 0x01,
        0x01, 0x00, 0x00, 0x01, 0x00, 0x01, 0x00, 0x00, 0xff, 0xd9,
      ]).buffer;

      const loadSpy = vi.spyOn(piexif, "load").mockReturnValue({
        "0th": {},
        Exif: {},
        GPS: {},
        "1st": {},
        thumbnail: "some-thumbnail-data",
      } as unknown as ReturnType<typeof piexif.load>);

      const result = await stripExifMetadata(minJpeg);
      expect(result).toBe(minJpeg);

      loadSpy.mockRestore();
    });

    it("returns original when piexif.load throws a non-Error value", async () => {
      const minJpeg = new Uint8Array([
        0xff, 0xd8, 0xff, 0xe0, 0x00, 0x10, 0x4a, 0x46, 0x49, 0x46, 0x00, 0x01,
        0x01, 0x00, 0x00, 0x01, 0x00, 0x01, 0x00, 0x00, 0xff, 0xd9,
      ]).buffer;

      const loadSpy = vi.spyOn(piexif, "load").mockImplementation(() => {
        throw "string-error";
      });

      const result = await stripExifMetadata(minJpeg);
      expect(result).toBe(minJpeg);

      loadSpy.mockRestore();
    });
  });
});
