import streamlit as st
import os
import subprocess
import json
import shutil
import glob
from groq import Groq
from PIL import Image

st.set_page_config(page_title="Bulk Image Generator", layout="wide")

st.title("🤖 Bukubot: Bulk Image Generator via Google Flow")
st.markdown("Aplikasi ini menggunakan Groq untuk merancang prompt, dan Playwright untuk mengotomasikan genarasi gambar di Google Flow.")

# Load API key dari file config jika ada
CONFIG_FILE = "config.json"
saved_api_key = ""
saved_suffix = None
saved_prefix = None
saved_templates: dict = {}
if os.path.exists(CONFIG_FILE):
    try:
        with open(CONFIG_FILE, "r") as f:
            config = json.load(f)
            saved_api_key = config.get("groq_api_key", "")
            saved_suffix = config.get("saved_suffix", None)
            saved_prefix = config.get("saved_prefix", None)
            saved_templates = config.get("templates", {})
    except Exception:
        pass

# Sidebar untuk konfigurasi API
with st.sidebar:
    st.header("Konfigurasi API")
    groq_api_key = st.text_input("Groq API Key (wajib)", type="password", value=saved_api_key)
    
    # Save the key automatically if it changes from the saved one and is not empty
    if groq_api_key and groq_api_key != saved_api_key:
        try:
            with open(CONFIG_FILE, "w") as f:
                json.dump({"groq_api_key": groq_api_key}, f)
            st.success("API Key berhasil disimpan!")
        except Exception as e:
            st.error(f"Gagal menyimpan API Key: {e}")
            
    st.markdown("[Dapatkan API Key Groq di sini](https://console.groq.com/keys)")

# Initialize Tabs
tab1, tab2 = st.tabs(["🚀 Generator", "🖼️ Curate & Preview"])

default_system_prompt = """You are a prompt generator for AI image models.

Goal: Generate detailed prompts for creating preschool coloring-book illustrations based on a dual-panel concept.

Output format rules (VERY IMPORTANT):
Output ONLY a list of prompts
One prompt per line
No numbering
No explanations
No headings
No blank lines
Each line must be a complete, highly detailed prompt

Prompt structure requirements:
Each prompt must describe a dual-panel preschool coloring book page with the following structure:

Page Layout:
Two equal vertical panels placed side-by-side on one printable page.

Left Panel (Color Reference):
A cute {CHARACTER} placed naturally inside a cozy indoor environment.
The room must automatically adapt to the character type.
Include clear spatial layout:
center: main character
floor: rug or play mat with toys
wall: shelves, pictures, or decorations
side: furniture such as chair, bed, toy box, or table
window area: curtains and soft sunlight
Include cozy elements such as pillows, cushions, blankets, small plants, toys, bookshelves, lamps, and simple decorations.
Style: pastel colors, soft lighting, flat vector illustration, simple shapes, child-friendly design, balanced composition, minimal but detailed background.

Right Panel (Coloring Page):
The exact same scene and composition as the left panel.
Converted into clean black outline coloring book style.
Bold smooth outlines only.
No colors.
No shading.
White background.
Suitable for preschool coloring.

Global style rules:
flat vector illustration
child-friendly proportions
simple shapes
clean lines
balanced composition
high resolution
printable coloring book layout

Content variation rules:
Each prompt must use a different character and environment
Characters can include animals, toy vehicles, robots, dinosaurs, aliens, birds, or teddy bears
Environments must adapt naturally to the character, clean printable page.

Generate exactly the number of prompts the user asks for."""

with tab1:
    # Bagian 1.0: Nama Project
    st.header("1. Nama Project")
    project_name = st.text_input("Masukkan nama project (folder & file akan menggunakan nama ini):", "buku_hewan_01")
    # Clean the project name
    safe_project_name = "".join(x for x in project_name if x.isalnum() or x in " -_").strip()
    
    st.header("2. Buat Prompt Ide")

    # Initialize session state defaults before expander
    if 'current_system_prompt' not in st.session_state:
        st.session_state.current_system_prompt = default_system_prompt
    if 'current_prefix' not in st.session_state:
        st.session_state.current_prefix = saved_prefix or ""
    if 'current_suffix' not in st.session_state:
        default_suffix_val = """STRICT LAYOUT RULES:
The illustration must contain ONLY the drawing content of the scene.
Do NOT add: page borders, decorative frames, titles, captions, text, labels, numbers, page numbers, watermarks, logos, UI elements, stickers.
The page must be clean and minimal.

BACKGROUND RULES:
Use a plain white background. No colored background. No patterns. No textures. No decorative borders.

PRINTABLE COLORING PAGE STYLE:
Center the illustration on the page with clean margins. Focus only on the illustration scene.
no frame, no border, no text, no title, no caption, no typography, no background pattern, plain white background, clean printable page."""
        st.session_state.current_suffix = saved_suffix or default_suffix_val

    with st.expander("⚙️ Konfigurasi Prompt Template (Lanjutan)", expanded=False):
        default_suffix_val = """STRICT LAYOUT RULES:
The illustration must contain ONLY the drawing content of the scene.
Do NOT add: page borders, decorative frames, titles, captions, text, labels, numbers, page numbers, watermarks, logos, UI elements, stickers.
The page must be clean and minimal.

BACKGROUND RULES:
Use a plain white background. No colored background. No patterns. No textures. No decorative borders.

PRINTABLE COLORING PAGE STYLE:
Center the illustration on the page with clean margins.
Focus only on the illustration scene.
no frame, no border, no text, no title, no caption, no typography, no background pattern, plain white background, clean printable page."""

        # Default template sebagai objek lengkap
        default_template_obj = {
            "system_prompt": default_system_prompt,
            "prefix": "",
            "suffix": default_suffix_val
        }

        if "Default Coloring Book" not in saved_templates:
            saved_templates["Default Coloring Book"] = default_template_obj
        elif isinstance(saved_templates["Default Coloring Book"], str):
            # Migrate lama (hanya string) ke format baru
            saved_templates["Default Coloring Book"] = default_template_obj

        # --- Pengaturan Prompt Template ---
        st.subheader("📚 Manajemen Prompt Template")
        tcol1, tcol2, tcol3 = st.columns([2, 1, 1])
        
        with tcol1:
            template_options = list(saved_templates.keys())
            selected_template = st.selectbox("Pilih Template Tersimpan:", template_options)
            
        with tcol2:
            st.write("")
            st.write("")
            if st.button("📥 Muat Template", use_container_width=True):
                tpl = saved_templates[selected_template]
                if isinstance(tpl, dict):
                    st.session_state.current_system_prompt = tpl.get("system_prompt", default_system_prompt)
                    st.session_state.current_prefix = tpl.get("prefix", "")
                    st.session_state.current_suffix = tpl.get("suffix", default_suffix_val)
                else:
                    # fallback lama
                    st.session_state.current_system_prompt = tpl
                    st.session_state.current_prefix = ""
                    st.session_state.current_suffix = default_suffix_val
                st.success(f"Template '{selected_template}' dimuat!")
                
        with tcol3:
            st.write("")
            st.write("")
            if st.button("🗑️ Hapus Template", use_container_width=True):
                if selected_template != "Default Coloring Book":
                    try:
                        with open(CONFIG_FILE, "r") as f:
                            config_data = json.load(f)
                        if "templates" in config_data and selected_template in config_data["templates"]:
                            del config_data["templates"][selected_template]
                            with open(CONFIG_FILE, "w") as f:
                                json.dump(config_data, f)
                        saved_templates.pop(selected_template, None)
                        st.success(f"Template '{selected_template}' dihapus!")
                        st.rerun()
                    except Exception as e:
                        st.error(f"Gagal menghapus: {e}")
                else:
                    st.error("Template 'Default Coloring Book' tidak bisa dihapus.")

        st.markdown("---")
        st.subheader("📝 Isi Template")

        # Initialize session state
        if 'current_system_prompt' not in st.session_state:
            st.session_state.current_system_prompt = default_system_prompt
        if 'current_prefix' not in st.session_state:
            st.session_state.current_prefix = saved_prefix or ""
        if 'current_suffix' not in st.session_state:
            st.session_state.current_suffix = saved_suffix or default_suffix_val

        system_prompt_input = st.text_area("System Prompt (Instruksi untuk AI):", value=st.session_state.current_system_prompt, height=250)
        prefix_prompt_input = st.text_area("✨ Awalan / Positif Prompt (di AWAL setiap gambar):", value=st.session_state.current_prefix, height=80)
        suffix_prompt_input = st.text_area("🚫 Akhiran / Negatif Prompt (di AKHIR setiap gambar):", value=st.session_state.current_suffix, height=180)

        # Simpan template baru
        st.markdown("---")
        scol1, scol2 = st.columns([3, 1])
        with scol1:
            new_template_name = st.text_input("Nama Template Baru:", "Template Customku")
        with scol2:
            st.write("")
            st.write("")
            if st.button("💾 Simpan sebagai Template Baru", use_container_width=True):
                if new_template_name.strip() == "":
                    st.error("Nama template tidak boleh kosong!")
                else:
                    try:
                        config_data = {}
                        if os.path.exists(CONFIG_FILE):
                            with open(CONFIG_FILE, "r") as f:
                                config_data = json.load(f)
                        
                        if "templates" not in config_data:
                            config_data["templates"] = {}
                        
                        new_tpl = {
                            "system_prompt": system_prompt_input,
                            "prefix": prefix_prompt_input,
                            "suffix": suffix_prompt_input
                        }
                        config_data["templates"][new_template_name] = new_tpl
                        
                        with open(CONFIG_FILE, "w") as f:
                            json.dump(config_data, f)
                        
                        st.success(f"Template '{new_template_name}' berhasil disimpan (System Prompt + Awalan + Akhiran)!")
                        saved_templates[new_template_name] = new_tpl
                    except Exception as e:
                        st.error(f"Gagal menyimpan template: {e}")

system_prompt_input = st.session_state.current_system_prompt
prefix_prompt_input = st.session_state.current_prefix
suffix_prompt_input = st.session_state.current_suffix

col1, col2 = st.columns([3, 1])
with col1:
    topic = st.text_input("Topik atau Tema Ekstra (Opsional):", "coloring book pages, simple, black and white outline, clear vector")
    number_n = st.number_input("Jumlah Prompt ({N}):", min_value=1, max_value=500, value=10)
    character_type = st.text_input("Karakter Utama ({CHARACTER}):", "cute animal")
with col2:
    st.write("") # Spacer
    st.write("")
    generate_btn = st.button("✨ Generate Prompt dgn Groq")

if generate_btn:
    if not groq_api_key:
        st.error("Silakan masukkan Groq API Key di sebelah kiri terlebih dahulu.")
    elif not system_prompt_input.strip():
        st.error("System prompt tidak boleh kosong.")
    else:
        with st.spinner("Merangkai prompt kreatif..."):
            try:
                final_system_prompt = system_prompt_input.replace("{N}", str(number_n)).replace("{CHARACTER}", character_type)
                client = Groq(api_key=groq_api_key)
                completion = client.chat.completions.create(
                    model="openai/gpt-oss-120b",
                    messages=[
                        {"role": "system", "content": final_system_prompt},
                        {"role": "user", "content": f"Generate prompts for: {topic}. Ensure you generate exactly {number_n} prompts about {character_type}."}
                    ],
                    temperature=0.7,
                )
                st.session_state.prompts = completion.choices[0].message.content.strip()
            except Exception as e:
                st.error(f"Terjadi kesalahan saat menghubungi Groq: {e}")

# Bagian 2: Kotak Teks Prompt
st.header("3. Tinjau & Edit Prompt")
st.markdown("Cek ulang hasil *generate* AI di bawah. **Satu baris = Satu prompt gambar.**")

default_prompts = st.session_state.get('prompts', '')
prompts_text = st.text_area("Daftar Prompt Utama:", value=default_prompts, height=250)

# Preview Prompt yang Akan Dikirim ke Google Flow
clean_preview_prefix = prefix_prompt_input.replace("\n", " ").strip()
clean_preview_suffix = suffix_prompt_input.replace("\n", " ").strip()
preview_lines = [f"{clean_preview_prefix} {p.strip()} {clean_preview_suffix}".strip() for p in prompts_text.split('\n') if p.strip()]

if preview_lines:
    with st.expander(f"👁️ Preview Prompt yang Akan Dikirim ke Google Flow ({len(preview_lines)} prompt)", expanded=False):
        for i, line in enumerate(preview_lines, 1):
            st.text_area(f"Prompt #{i}", value=line, height=80, key=f"preview_{i}", disabled=True)

# Bagian 3: Eksekusi Playwright
st.header("4. Eksekusi di Google Flow")
if st.button("🚀 Mulai Automasi Playwright"):
    if not safe_project_name:
        st.error("Nama project tidak boleh kosong!")
    else:
        # Bersihkan baris kosong dan gabungkan dengan prefix & suffix
        clean_prefix = prefix_prompt_input.replace("\n", " ").strip()
        clean_suffix = suffix_prompt_input.replace("\n", " ").strip()
        
        prompt_list = []
        for p in prompts_text.split('\n'):
            if p.strip():
                # Gabungkan awalan + prompt asli + akhiran menjadi 1 baris utuh
                full_prompt = f"{clean_prefix} {p.strip()} {clean_suffix}".strip()
                prompt_list.append(full_prompt)
        
        if not prompt_list:
            st.warning("Daftar prompt tidak boleh kosong!")
        else:
            # Buat folder project
            project_dir = os.path.join("projects", safe_project_name)
            os.makedirs(project_dir, exist_ok=True)
            
            # Simpan ke file JSON di dalam folder project
            prompts_file_path = os.path.join(project_dir, "prompts.json")
            with open(prompts_file_path, "w", encoding="utf-8") as f:
                json.dump(prompt_list, f)
                
            st.success(f"Project '{safe_project_name}' disiapkan dengan {len(prompt_list)} prompt. Membuka Playwright...")
            
            # Jalankan script bot terpisah dan lemparkan nama project-nya
            subprocess.Popen(["python", "playwright_bot.py", "--project", safe_project_name])

with tab2:
    st.header("🖼️ Curate & Preview Project")
    
    # 1. Pilih Project
    projects_dir = "projects"
    if not os.path.exists(projects_dir):
        st.info("Belum ada project yang dibuat.")
    else:
        project_list = [d for d in os.listdir(projects_dir) if os.path.isdir(os.path.join(projects_dir, d))]
        if not project_list:
             st.info("Belum ada project yang dibuat.")
        else:
            selected_project = st.selectbox("Pilih Project:", project_list)
            
            if selected_project:
                # Use absolute paths to avoid working directory confusion in Streamlit
                base_dir = os.path.abspath(os.getcwd())
                raw_images_dir = os.path.join(base_dir, projects_dir, selected_project, "raw_images")
                final_images_dir = os.path.join(base_dir, projects_dir, selected_project, "final")
                
                if not os.path.exists(raw_images_dir):
                    st.warning(f"Belum ada gambar yang di-generate untuk project '{selected_project}'.")
                    st.caption(f"Mencari di path: {raw_images_dir}")
                else:
                    # Ambil semua file gambar
                    all_images = glob.glob(os.path.join(raw_images_dir, "*.png"))
                    all_images.sort() # Ensure prompt_01 comes before prompt_02
                    
                    if not all_images:
                        st.warning("Folder raw_images kosong.")
                        st.caption(f"Path: {raw_images_dir}")
                    else:
                        st.write(f"Ditemukan {len(all_images)} gambar. Silakan pilih gambar yang ingin dimasukkan ke folder final.")
                        
                        # Group images by prompt number
                        # Format nama file: prompt_XX_var_Y.png
                        grouped_images = {}
                        for img_path in all_images:
                            filename = os.path.basename(img_path)
                            parts = filename.split("_")
                            if len(parts) >= 2 and parts[0] == "prompt":
                                prompt_num = parts[1]
                                if prompt_num not in grouped_images:
                                    grouped_images[prompt_num] = []
                                grouped_images[prompt_num].append(img_path)
                        
                        # Tampilkan UI pemilihan
                        selected_files = []
                        
                        for prompt_num, images in grouped_images.items():
                            st.subheader(f"Prompt {prompt_num}")
                            cols = st.columns(len(images))
                            
                            for idx, img_path in enumerate(images):
                                with cols[idx]:
                                    st.image(img_path, use_container_width=True)
                                    filename = os.path.basename(img_path)
                                    # Create a unique key for the checkbox
                                    is_selected = st.checkbox(f"Pilih", key=f"chk_{selected_project}_{filename}")
                                    if is_selected:
                                        selected_files.append(img_path)
                                        
                        st.markdown("---")
                        st.subheader("Finalisasi")
                        st.write(f"Total gambar terpilih: **{len(selected_files)}**")
                        
                        if st.button("💾 Pindah ke Folder Final"):
                            if not selected_files:
                                st.error("Silakan pilih minimal 1 gambar terlebih dahulu.")
                            else:
                                os.makedirs(final_images_dir, exist_ok=True)
                                
                                # Kosongkan isi folder final sebelumnya jika mau berurutan bersih 
                                # (opsional, tapi bagus agar tidak menumpuk)
                                for old_file in glob.glob(os.path.join(final_images_dir, "*.png")):
                                    os.remove(old_file)
                                
                                # Copy files and rename iteratively
                                for idx, src_path in enumerate(selected_files):
                                    new_filename = f"{idx + 1}.png"
                                    dest_path = os.path.join(final_images_dir, new_filename)
                                    shutil.copy2(src_path, dest_path)
                                    
                                st.success(f"Berhasil memindahkan {len(selected_files)} gambar ke folder final project '{selected_project}'.")
                                st.info("File dinamai berurutan mulai dari 1.png, 2.png, dst.")

                        # --- PDF GENERATOR UI ---
                        st.markdown("---")
                        st.subheader("📚 Generate Buku KDP (PDF)")
                        st.write("Jadikan gambar-gambar di folder `final` menjadi buku siap cetak untuk Amazon KDP (8.5 x 11 inch).")
                        
                        if st.button("📄 Generate Buku PDF (Siap KDP)"):
                            final_dir_check = os.path.join(base_dir, projects_dir, selected_project, "final")
                            if not os.path.exists(final_dir_check) or not os.listdir(final_dir_check):
                                st.error("Folder final kosong. Silakan kurasi gambar terlebih dahulu!")
                            else:
                                with st.spinner("Memproses halaman PDF (Mohon tunggu)..."):
                                    try:
                                        # Ambil urutan gambar 1.png, 2.png secara numerik agar tdk acak
                                        def get_num(filename):
                                            try:
                                                return int(os.path.basename(filename).split('.')[0])
                                            except:
                                                return 9999
                                        
                                        final_images_list = glob.glob(os.path.join(final_dir_check, "*.png"))
                                        final_images_list.sort(key=get_num)
                                        
                                        if not final_images_list:
                                            st.error("Tidak ada gambar .png di folder final.")
                                        else:
                                            # Resolusi standar cetak 300 DPI untuk 8.5 x 11 Inch
                                            PAGE_WIDTH = 2550
                                            PAGE_HEIGHT = 3300
                                            pdf_pages = []
                                            
                                            for img_path in final_images_list:
                                                img = Image.open(img_path).convert("RGB")
                                                # Beri margin 0.5 inch (150px kiri, kanan, atas, bwh)
                                                target_w = PAGE_WIDTH - 300
                                                target_h = PAGE_HEIGHT - 300
                                                
                                                # Ubah ukuran agar pas tanpa merusak rasio gambar
                                                img.thumbnail((target_w, target_h), Image.Resampling.LANCZOS)
                                                
                                                # Buat kanvas putih dasar 8.5 x 11
                                                page = Image.new("RGB", (PAGE_WIDTH, PAGE_HEIGHT), "white")
                                                
                                                # Tempel gambar di tengah kertas
                                                paste_x = (PAGE_WIDTH - img.width) // 2
                                                paste_y = (PAGE_HEIGHT - img.height) // 2
                                                page.paste(img, (paste_x, paste_y))
                                                pdf_pages.append(page)
                                                
                                                # WAJIB KDP Coloring Book: Kertas belakangnya harus putih kosong
                                                blank_page = Image.new("RGB", (PAGE_WIDTH, PAGE_HEIGHT), "white")
                                                pdf_pages.append(blank_page)
                                            
                                            pdf_path = os.path.join(final_dir_check, f"{selected_project}_KDP_Format.pdf")
                                            pdf_pages[0].save(
                                                pdf_path,
                                                "PDF",
                                                resolution=300.0,
                                                save_all=True,
                                                append_images=pdf_pages[1:]
                                            )
                                            
                                            st.success(f"Buku PDF berhasil dibuat: **{os.path.basename(pdf_path)}**")
                                            st.info(f"Lokasi file: `{pdf_path}`")
                                            
                                            # --- Preview Halaman PDF ---
                                            preview_count = min(6, len(final_images_list))
                                            st.markdown(f"**Preview {preview_count} halaman pertama buku:**")
                                            prev_cols = st.columns(3)
                                            for pidx in range(preview_count):
                                                with prev_cols[pidx % 3]:
                                                    # Buat thumbnail dengan margin (sama seperti halaman PDF, tapi ukuran kecil)
                                                    prev_img = Image.open(final_images_list[pidx]).convert("RGB")
                                                    THUMB_W, THUMB_H = 510, 660  # 1/5 dari 2550x3300
                                                    prev_img.thumbnail((THUMB_W - 60, THUMB_H - 60), Image.Resampling.LANCZOS)
                                                    thumb_page = Image.new("RGB", (THUMB_W, THUMB_H), "white")
                                                    tx = (THUMB_W - prev_img.width) // 2
                                                    ty = (THUMB_H - prev_img.height) // 2
                                                    thumb_page.paste(prev_img, (tx, ty))
                                                    st.image(thumb_page, caption=f"Halaman {pidx + 1}", use_container_width=True)
                                    except Exception as e:
                                        st.error(f"Gagal membuat PDF: {e}")
