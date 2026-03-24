import * as ImageManipulator from 'expo-image-manipulator';

/**
 * Compresses an image and converts it to WebP format.
 * @param {string} imageUri - The original image URI from the device.
 * @returns {Promise<string>} - The URI of the compressed WebP image.
 */
export const compressImageToWebP = async (imageUri) => {
  try {
    const manipResult = await ImageManipulator.manipulateAsync(
      imageUri,
      // 1. Resize the image (Optional but highly recommended)
      // If the user uploads a 4K photo, we scale it down to a max width of 1080px.
      [{ resize: { width: 1080 } }], 
      
      // 2. Compress and Convert
      { 
        compress: 0.7, // Quality from 0 to 1 (0.7 is a great balance of size/quality)
        format: ImageManipulator.SaveFormat.WEBP 
      }
    );

    console.log("Original URI:", imageUri);
    console.log("Compressed WebP URI:", manipResult.uri);

    return manipResult.uri; // Use this URI to upload to Firebase

  } catch (error) {
    console.error("Error compressing image:", error);
    // If something fails, fallback to the original image so the upload doesn't break
    return imageUri; 
  }
};