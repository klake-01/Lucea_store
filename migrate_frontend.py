import os
import shutil

base_dir = r"d:\3D Designs\lamp_store"
frontend_dir = os.path.join(base_dir, "frontend")
os.makedirs(frontend_dir, exist_ok=True)

# 1. Directories to move to frontend
dirs_to_move = ["src", "public"]
for d in dirs_to_move:
    src = os.path.join(base_dir, d)
    dst = os.path.join(frontend_dir, d)
    if os.path.exists(src) and not os.path.exists(dst):
        shutil.move(src, dst)
        print(f"Moved directory {d} to frontend/{d}")

# 2. Individual files to move to frontend
files_to_move = [
    "index.html",
    "package.json",
    "package-lock.json",
    "vite.config.ts",
    "vite.config.js",
    "vite.config.d.ts",
    "tsconfig.json",
    "tsconfig.node.json",
    "tsconfig.node.tsbuildinfo",
    "tsconfig.tsbuildinfo",
    "vercel.json",
]

for f in files_to_move:
    src = os.path.join(base_dir, f)
    dst = os.path.join(frontend_dir, f)
    if os.path.exists(src):
        shutil.move(src, dst)
        print(f"Moved file {f} to frontend/{f}")

# Move Dockerfile.web to frontend/Dockerfile
dockerfile_web = os.path.join(base_dir, "Dockerfile.web")
dockerfile_dst = os.path.join(frontend_dir, "Dockerfile")
if os.path.exists(dockerfile_web):
    shutil.move(dockerfile_web, dockerfile_dst)
    print("Moved Dockerfile.web to frontend/Dockerfile")

# 3. Create frontend/scripts and move frontend-specific scripts
frontend_scripts_dir = os.path.join(frontend_dir, "scripts")
os.makedirs(frontend_scripts_dir, exist_ok=True)

frontend_scripts = [
    "prerender.ts",
    "blogRoutes.ts",
    "generate-sitemap.ts",
    "accent.py"
]

root_scripts_dir = os.path.join(base_dir, "scripts")
for s in frontend_scripts:
    src = os.path.join(root_scripts_dir, s)
    dst = os.path.join(frontend_scripts_dir, s)
    if os.path.exists(src):
        shutil.move(src, dst)
        print(f"Moved script {s} to frontend/scripts/{s}")

print("Move complete!")
