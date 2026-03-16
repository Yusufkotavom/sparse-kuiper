import os
from PIL import Image

PAGE_WIDTH = 2550
PAGE_HEIGHT = 3300

def create_kdp_pdf(image_paths: list[str], output_filename: str, output_dir: str) -> str:
    """Takes a list of image paths and weaves them into a KDP compliant PDF."""
    if not image_paths:
        raise ValueError("No images provided to weave into PDF.")
        
    os.makedirs(output_dir, exist_ok=True)
    pdf_path = os.path.join(output_dir, output_filename)
    
    pdf_pages = []
    for img_path in image_paths:
        try:
            img = Image.open(img_path).convert("RGB")
            # Margins
            target_w = PAGE_WIDTH - 300
            target_h = PAGE_HEIGHT - 300
            
            img.thumbnail((target_w, target_h), Image.Resampling.LANCZOS)
            
            page = Image.new("RGB", (PAGE_WIDTH, PAGE_HEIGHT), "white")
            paste_x = (PAGE_WIDTH - img.width) // 2
            paste_y = (PAGE_HEIGHT - img.height) // 2
            page.paste(img, (paste_x, paste_y))
            pdf_pages.append(page)
            
            # KDP requires blank back page
            blank_page = Image.new("RGB", (PAGE_WIDTH, PAGE_HEIGHT), "white")
            pdf_pages.append(blank_page)
        except Exception as e:
            # Log error but continue
            print(f"Failed to process image {img_path}: {e}")
            continue

    if not pdf_pages:
        raise ValueError("Could not process any valid images for the PDF.")

    pdf_pages[0].save(
        pdf_path,
        "PDF",
        resolution=300.0,
        save_all=True,
        append_images=pdf_pages[1:]
    )
    
    return pdf_path
