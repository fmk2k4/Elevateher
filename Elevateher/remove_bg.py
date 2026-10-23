import sys
from rembg import remove
from PIL import Image

input_path = sys.argv[1]
output_path1 = sys.argv[2]
output_path2 = sys.argv[3]

# Read input image
print(f"Reading {input_path}")
input_image = Image.open(input_path)

# Remove background
print("Removing background...")
output_image = remove(input_image)

# Save output
print(f"Saving to {output_path1}")
output_image.save(output_path1, "PNG")

print(f"Saving to {output_path2}")
output_image.save(output_path2, "PNG")

print("Done!")
