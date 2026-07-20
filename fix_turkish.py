import os

replacements = {
    'Ä±': 'ı',
    'ÅŸ': 'ş',
    'ÄŸ': 'ğ',
    'Ã¼': 'ü',
    'Ã¶': 'ö',
    'Ã§': 'ç',
    'Ä°': 'İ',
    'Åž': 'Ş',
    'Äž': 'Ğ',
    'Ãœ': 'Ü',
    'Ã–': 'Ö',
    'Ã‡': 'Ç'
}

def process_dir(directory):
    for root, _, files in os.walk(directory):
        for file in files:
            if file.endswith(('.jsx', '.js', '.css', '.html')):
                path = os.path.join(root, file)
                with open(path, 'r', encoding='utf-8') as f:
                    try:
                        content = f.read()
                    except UnicodeDecodeError:
                        continue
                
                changed = False
                for k, v in replacements.items():
                    if k in content:
                        content = content.replace(k, v)
                        changed = True
                
                if changed:
                    with open(path, 'w', encoding='utf-8') as f:
                        f.write(content)
                    print(f"Fixed Turkish characters in {path}")

process_dir('frontend/src')
