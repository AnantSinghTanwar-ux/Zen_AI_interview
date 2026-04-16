import os
import glob

# Find all page.tsx files in the app directory
files = glob.glob('app/**/page.tsx', recursive=True) + glob.glob('app/**/page-clean.tsx', recursive=True)

for file in files:
    with open(file, 'r', encoding='utf-8') as f:
        content = f.read()

    # Only process files that have the white background bg-[#f5f5f7]
    if 'bg-[#f5f5f7]' in content:
        # Replace text-foreground and text-white with text-black
        content = content.replace('text-foreground', 'text-black')
        content = content.replace('text-white', 'text-black')
        
        # Add text-black to h1, h2, h3 tags if they don't have it explicitly
        content = content.replace('<h1 className="', '<h1 className="text-black ')
        content = content.replace('<h2 className="', '<h2 className="text-black ')
        content = content.replace('<h3 className="', '<h3 className="text-black ')
        
        # Write back
        with open(file, 'w', encoding='utf-8') as f:
            f.write(content)
        print(f'Fixed text coloring in {file}')
