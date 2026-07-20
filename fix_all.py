import codecs
import os

replacements = {
    'â‹®â‹®': '⋮⋮',
    'â‹®': '⋮',
    'âœ ï¸ ': '✏️',
    'âœ•': '✕',
    'ğŸ‘¥': '👥',
    'âŠ–': '⊖',
    'â†‘': '↑',
    'â†“': '↓',
    'â–¼': '▼',
    'â–¶': '▶',
    'â†³': '↳',
    'ğŸ“…': '📅',
    'ğŸ‘¤': '👤',
    'ğŸ”—': '🔗',
    'Æ’': 'ƒ',
    'ğŸ†”': '🆔',
    'â ±ï¸ ': '⏱️',
    'ğŸ” ': '🔍',
    'âœ…': '✅'
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
                    print(f"Fixed {path}")

process_dir('frontend/src')
