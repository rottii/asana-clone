import React, { useState, useEffect } from 'react';
import { useEditor, EditorContent } from '@tiptap/react';
import { FloatingMenu, BubbleMenu } from '@tiptap/react/menus';
import StarterKit from '@tiptap/starter-kit';
import Placeholder from '@tiptap/extension-placeholder';
import Underline from '@tiptap/extension-underline';
import Highlight from '@tiptap/extension-highlight';
import { Image } from '@tiptap/extension-image';
import { Link } from '@tiptap/extension-link';
import { Table } from '@tiptap/extension-table';
import { TableRow } from '@tiptap/extension-table-row';
import { TableCell } from '@tiptap/extension-table-cell';
import { TableHeader } from '@tiptap/extension-table-header';
import { GithubPRExtension } from './GithubPRExtension';

// ---- Toolbar Icon SVG Components ----
const IconPlus = () => <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M12 5v14M5 12h14" /></svg>;
const IconUndo = () => <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M3 7v6h6M3 13l5-5c3.5-3.5 9.5-3.5 13 0 3.5 3.5 3.5 9.5 0 13-3.5 3.5-9.5 3.5-13 0" /></svg>;
const IconRedo = () => <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M21 7v6h-6M21 13l-5-5c-3.5-3.5-9.5-3.5-13 0-3.5 3.5-3.5 9.5 0 13 3.5 3.5 9.5 3.5 13 0" /></svg>;
const IconBold = () => <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M6 4h8a4 4 0 0 1 4 4 4 4 0 0 1-4 4H6z" /><path d="M6 12h9a4 4 0 0 1 4 4 4 4 0 0 1-4 4H6z" /></svg>;
const IconItalic = () => <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><line x1="19" y1="4" x2="10" y2="4"></line><line x1="14" y1="20" x2="5" y2="20"></line><line x1="15" y1="4" x2="9" y2="20"></line></svg>;
const IconUnderline = () => <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M6 3v7a6 6 0 0 0 6 6 6 6 0 0 0 6-6V3"></path><line x1="4" y1="21" x2="20" y2="21"></line></svg>;
const IconMarker = () => <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M12 19l7-7 3 3-7 7-3-3z" /><path d="M18 13l-1.5-7.5L2 2l3.5 14.5L13 18l5-5z" /><path d="M2 2l7.586 7.586" /><circle cx="11" cy="11" r="2" /></svg>;
const IconStrikethrough = () => <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M16 4H9a3 3 0 0 0-2.83 4" /><path d="M14 12a4 4 0 0 1 0 8H6" /><line x1="4" y1="12" x2="20" y2="12"></line></svg>;
const IconBulletList = () => <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><line x1="8" y1="6" x2="21" y2="6"></line><line x1="8" y1="12" x2="21" y2="12"></line><line x1="8" y1="18" x2="21" y2="18"></line><line x1="3" y1="6" x2="3.01" y2="6"></line><line x1="3" y1="12" x2="3.01" y2="12"></line><line x1="3" y1="18" x2="3.01" y2="18"></line></svg>;
const IconOrderedList = () => <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><line x1="10" y1="6" x2="21" y2="6"></line><line x1="10" y1="12" x2="21" y2="12"></line><line x1="10" y1="18" x2="21" y2="18"></line><path d="M4 6h1v4" /><path d="M4 10h2" /><path d="M6 18H4c0-1 2-2 2-3s-1-1.5-2-1" /></svg>;
const IconLink = () => <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M10 13a5 5 0 0 0 7.54.54l3-3a5 5 0 0 0-7.07-7.07l-1.72 1.71"></path><path d="M14 11a5 5 0 0 0-7.54-.54l-3 3a5 5 0 0 0 7.07 7.07l1.71-1.71"></path></svg>;
const IconCode = () => <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><polyline points="16 18 22 12 16 6"></polyline><polyline points="8 6 2 12 8 18"></polyline></svg>;
const IconQuote = () => <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M21 11.5a8.38 8.38 0 0 1-.9 3.8 8.5 8.5 0 0 1-7.6 4.7 8.38 8.38 0 0 1-3.8-.9L3 21l1.9-5.7a8.38 8.38 0 0 1-.9-3.8 8.5 8.5 0 0 1 4.7-7.6 8.38 8.38 0 0 1 3.8-.9h.5a8.48 8.48 0 0 1 8 8v.5z"></path></svg>;
const IconMagicWand = () => <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M20.9 14.5A2.9 2.9 0 0 0 23 12a2.9 2.9 0 0 0-2.1-2.5l-.2-.1A2.9 2.9 0 0 0 19 8.1l-.1-.2A2.9 2.9 0 0 0 17 6c-1.3 0-2.4 1-2.5 2.2l-.1.2A2.9 2.9 0 0 0 13 9.7l-.2.1A2.9 2.9 0 0 0 11 12a2.9 2.9 0 0 0 1.9 2.4l.2.1A2.9 2.9 0 0 0 14.6 16l.1.2A2.9 2.9 0 0 0 17 18a2.9 2.9 0 0 0 2.4-1.9l.1-.2A2.9 2.9 0 0 0 20.7 14.6l.2-.1z" /><path d="m3 21 6.5-6.5" /></svg>;
const IconSearch = () => <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><circle cx="11" cy="11" r="8"></circle><line x1="21" y1="21" x2="16.65" y2="16.65"></line></svg>;
const IconMenu = () => <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><line x1="3" y1="12" x2="21" y2="12"></line><line x1="3" y1="6" x2="21" y2="6"></line><line x1="3" y1="18" x2="21" y2="18"></line></svg>;

const InsertMenu = ({ editor, onClose }) => {
  const [showEmojiPicker, setShowEmojiPicker] = useState(false);
  const [inputConfig, setInputConfig] = useState(null);
  const [inputValue, setInputValue] = useState('');
  const menuRef = React.useRef(null);

  useEffect(() => {
    if (menuRef.current) {
      // Reset to default downward measurement
      menuRef.current.style.top = '100%';
      menuRef.current.style.bottom = 'auto';
      menuRef.current.style.transform = 'none';

      const rect = menuRef.current.getBoundingClientRect();
      if (rect.bottom > window.innerHeight - 20) {
        const topWhenUp = rect.top - 24 - rect.height; // approximate top if opening upwards
        if (topWhenUp < 60) {
          // Center vertically relative to the button
          menuRef.current.style.top = '50%';
          menuRef.current.style.bottom = 'auto';
          menuRef.current.style.transform = 'translateY(-50%)';
        } else {
          // Open upwards
          menuRef.current.style.top = 'auto';
          menuRef.current.style.bottom = '100%';
          menuRef.current.style.transform = 'none';
        }
      }
    }
  }, [showEmojiPicker, inputConfig]);

  if (!editor) return null;

  const handleImageUpload = () => {
    const input = document.createElement('input');
    input.type = 'file';
    input.accept = 'image/*';
    input.onchange = (e) => {
      const file = e.target.files[0];
      if (file) {
        const reader = new FileReader();
        reader.onload = (event) => {
          editor.commands.insertContent(`<img src="${event.target.result}" style="max-width:100%; border-radius:6px; margin: 12px 0;" />`);
        };
        reader.readAsDataURL(file);
      }
    };
    input.click();
    onClose();
  };

  const emojiCategories = [
    {
      name: 'Smileys & People',
      icon: '😃',
      emojis: ['😀', '😃', '😄', '😁', '😆', '😅', '😂', '🤣', '🥲', '☺️', '😊', '😇', '🙂', '🙃', '😉', '😌', '😍', '🥰', '😘', '😗', '😙', '😚', '😋', '😛', '😝', '😜', '🤪', '🤨', '🧐', '🤓', '😎', '🥸', '🤩', '🥳', '😏', '😒', '😞', '😔', '😟', '😕', '🙁', '☹️', '😣', '😖', '😫', '😩', '🥺', '😢', '😭', '😤', '😠', '😡', '🤬', '🤯', '😳', '🥵', '🥶', '😱', '😨', '😰', '😥', '😓', '🤗', '🤔', '🤭', '🤫', '🤥', '😶', '😐', '😑', '😬', '🙄', '😯', '😦', '😧', '😮', '😲', '🥱', '😴', '🤤', '😪', '😵', '🤐', '🥴', '🤢', '🤮', '🤧', '😷', '🤒', '🤕', '🤑', '🤠', '😈', '👿', '👹', '👺', '🤡', '💩', '👻', '💀', '☠️', '👽', '👾', '🤖', '🎃', '😺', '😸', '😹', '😻', '😼', '😽', '🙀', '😿', '😾']
    },
    {
      name: 'Animals & Nature',
      icon: '🐻',
      emojis: ['🐶', '🐱', '🐭', '🐹', '🐰', '🦊', '🐻', '🐼', '🐻‍❄️', '🐨', '🐯', '🦁', '🐮', '🐷', '🐽', '🐸', '🐵', '🙈', '🙉', '🙊', '🐒', '🐔', '🐧', '🐦', '🐤', '🐣', '🐥', '🦆', '🦅', '🦉', '🦇', '🐺', '🐗', '🐴', '🦄', '🐝', '🪱', '🐛', '🦋', '🐌', '🐞', '🐜', '🪰', '🪲', '🪳', '🦟', '🦗', '🕷', '🕸', '🦂', '🐢', '🐍', '🦎', '🦖', '🦕', '🐙', '🦑', '🦐', '🦞', '🦀', '🐡', '🐠', '🐟', '🐬', '🐳', '🐋', '🦈', '🦭', '🐊', '🐅', '🐆', '🦓', '🦍', '🦧', '🦣', '🐘', '🦛', '🦏', '🐪', '🐫', '🦒', '🦘', '🦬', '🐃', '🐂', '🐄', '🐎', '🐖', '🐏', '🐑', '🦙', '🐐', '🦌', '🐕', '🐩', '🦮', '🐕‍🦺', '🐈', '🐈‍⬛', '🪶', '🐓', '🦃', '🦤', '🦚', '🦜', '🦢', '🦩', '🕊', '🐇', '🦝', '🦨', '🦡', '🦫', '🦦', '🦥', '🐁', '🐀', '🐿', '🦔', '🐾', '🐉', '🐲', '🌵', '🎄', '🌲', '🌳', '🌴', '🪵', '🌱', '🌿', '☘️', '🍀', '🎍', '🪴', '🎋', '🍃', '🍂', '🍁', '🍄', '🐚', '🪨', '🌾', '💐', '🌷', '🌹', '🥀', '🌺', '🌸', '🌼', '🌻', '🌞', '🌝', '🌛', '🌜', '🌚', '🌕', '🌖', '🌗', '🌘', '🌑', '🌒', '🌓', '🌔', '🌙', '🌎', '🌍', '🌏', '🪐', '💫', '⭐️', '🌟', '✨', '⚡️', '☄️', '💥', '🔥', '🌪', '🌈', '☀️', '🌤', '⛅️', '🌥', '☁️', '🌦', '🌧', '⛈', '🌩', '🌨', '❄️', '☃️', '⛄️', '🌬', '💨', '💧', '💦', '☔️', '☂️', '🌊', '🌫']
    },
    {
      name: 'Food & Drink',
      icon: '🍔',
      emojis: ['🍏', '🍎', '🍐', '🍊', '🍋', '🍌', '🍉', '🍇', '🍓', '🫐', '🍈', '🍒', '🍑', '🥭', '🍍', '🥥', '🥝', '🍅', '🍆', '🥑', '🥦', '🥬', '🥒', '🌶', '🫑', '🌽', '🥕', '🫒', '🧄', '🧅', '🥔', '🍠', '🥐', '🥯', '🍞', '🥖', '🥨', '🧀', '🥚', '🍳', '🧈', '🥞', '🧇', '🥓', '🥩', '🍗', '🍖', '🌭', '🍔', '🍟', '🍕', '🫓', '🥪', '🥙', '🧆', '🌮', '🌯', '🫔', '🥗', '🥘', '🫕', '🥫', '🍝', '🍜', '🍲', '🍛', '🍣', '🍱', '🥟', '🦪', '🍤', '🍙', '🍚', '🍘', '🍥', '🥠', '🥮', '🍢', '🍡', '🍧', '🍨', '🍦', '🥧', '🧁', '🍰', '🎂', '🍮', '🍭', '🍬', '🍫', '🍿', '🍩', '🍪', '🌰', '🥜', '🍯', '🥛', '🍼', '🫖', '☕️', '🍵', '🧃', '🥤', '🧋', '🍶', '🍺', '🍻', '🥂', '🍷', '🥃', '🍸', '🍹', '🧉', '🍾', '🧊', '🥄', '🍴', '🍽', '🥣', '🥡', '🥢', '🧂']
    },
    {
      name: 'Activities',
      icon: '⚽',
      emojis: ['⚽️', '🏀', '🏈', '⚾️', '🥎', '🎾', '🏐', '🏉', '🥏', '🎱', '🪀', '🏓', '🏸', '🏒', '🏑', '🥍', '🏏', '🪃', '🥅', '⛳️', '🪁', '🏹', '🎣', '🤿', '🥊', '🥋', '🎽', '🛹', '🛼', '🛷', '⛸', '🥌', '🎿', '⛷', '🏂', '🪂', '🏋️', '🤼', '🤸', '⛹️', '🤺', '🤾', '🏌️', '🏇', '🧘', '🏄', '🏊', '🤽', '🚣', '🧗', '🚵', '🚴', '🏆', '🥇', '🥈', '🥉', '🏅', '🎖', '🏵', '🎗', '🎫', '🎟', '🎪', '🤹', '🎭', '🩰', '🎨', '🎬', '🎤', '🎧', '🎼', '🎹', '🥁', '🪘', '🎷', '🎺', '🪗', '🎸', '🪕', '🎻', '🎲', '♟', '🎯', '🎳', '🎮', '🎰', '🧩']
    },
    {
      name: 'Travel & Places',
      icon: '🚗',
      emojis: ['🚗', '🚕', '🚙', '🚌', '🚎', '🏎', '🚓', '🚑', '🚒', '🚐', '🛻', '🚚', '🚛', '🚜', '🦯', '🦽', '🦼', '🛴', '🚲', '🛵', '🏍', '🛺', '🚨', '🚔', '🚍', '🚘', '🚖', '🚡', '🚠', '🚟', '🚃', '🚋', '🚞', '🚝', '🚄', '🚅', '🚈', '🚂', '🚆', '🚇', '🚊', '🚉', '✈️', '🛫', '🛬', '🛩', '💺', '🛰', '🚀', '🛸', '🚁', '🛶', '⛵️', '🚤', '🛥', '🛳', '⛴', '🚢', '⚓️', '🪝', '⛽️', '🚧', '🚦', '🚥', '🚏', '🗺', '🗿', '🗽', '🗼', '🏰', '🏯', '🏟', '🎡', '🎢', '🎠', '⛲️', '⛱', '🏖', '🏝', '🏜', '🌋', '⛰', '🏔', '🗻', '🏕', '⛺️', '🛖', '🏠', '🏡', '🏘', '🏚', '🏗', '🏭', '🏢', '🏬', '🏣', '🏤', '🏥', '🏦', '🏨', '🏪', '🏫', '🏩', '💒', '🏛', '⛪️', '🕌', '🕍', '🛕', '🕋', '⛩', '🛤', '🛣', '🗾', '🎑', '🏞', '🌅', '🌄', '🌠', '🎇', '🎆', '🌇', '🌆', '🏙', '🌃', '🌌', '🌉', '🌁']
    },
    {
      name: 'Objects',
      icon: '💡',
      emojis: ['⌚️', '📱', '📲', '💻', '⌨️', '🖥', '🖨', '🖱', '🖲', '🕹', '🗜', '💽', '💾', '💿', '📀', '📼', '📷', '📸', '📹', '🎥', '📽', '🎞', '📞', '☎️', '📟', '📠', '📺', '📻', '🎙', '🎚', '🎛', '🧭', '⏱', '⏲', '⏰', '🕰', '⌛️', '⏳', '📡', '🔋', '🔌', '💡', '🔦', '🕯', '🪔', '🧯', '🛢', '💸', '💵', '💴', '💶', '💷', '🪙', '💰', '💳', '💎', '⚖️', '🪜', '🧰', '🪛', '🔧', '🔨', '⚒', '🛠', '⛏', '🪚', '🔩', '⚙️', '🪤', '🧱', '⛓', '🧲', '🔫', '💣', '🧨', '🪓', '🔪', '🗡', '⚔️', '🛡', '🚬', '⚰️', '🪦', '⚱️', '🏺', '🔮', '📿', '🧿', '💈', '⚗️', '🔭', '🔬', '🕳', '🩹', '🩺', '💊', '💉', '🩸', '🧬', '🦠', '🧫', '🧪', '🌡', '🧹', '🪠', '🧺', '🧻', '🚽', '🚰', '🚿', '🛁', '🛀', '🧼', '🪥', '🪒', '🧽', '🪣', '🧴', '🛎', '🔑', '🗝', '🚪', '🪑', '🛋', '🛏', '🛌', '🧸', '🪆', '🖼', '🛍', '🛒', '🎁', '🎈', '🎏', '🎀', '🪄', '🪅', '🎊', '🎉', '🎎', '🏮', '🎐', '🧧', '✉️', '📩', '📨', '📧', '💌', '📥', '📤', '📦', '🏷', '🪧', '📪', '📫', '📬', '📭', '📮', '📯', '📜', '📃', '📄', '📑', '🧾', '📊', '📈', '📉', '🗒', '🗓', '📆', '📅', '🗑', '📇', '🗃', '🗳', '🗄', '📋', '📁', '📂', '🗂', '🗞', '📰', '📓', '📔', '📒', '📕', '📗', '📘', '📙', '📚', '📖', '🔖', '🧷', '🔗', '📎', '🖇', '📐', '📏', '🧮', '📌', '📍', '✂️', '🖊', '🖋', '✒️', '🖌', '🖍', '📝', '✏️', '🔍', '🔎', '🔏', '🔐', '🔒', '🔓']
    },
    {
      name: 'Symbols',
      icon: '🎶',
      emojis: ['❤️', '🧡', '💛', '💚', '💙', '💜', '🖤', '🤍', '🤎', '💔', '❤️‍🔥', '❤️‍🩹', '❣️', '💕', '💞', '💓', '💗', '💖', '💘', '💝', '💟', '☮️', '✝️', '☪️', '🕉', '☸️', '✡️', '🔯', '🕎', '☯️', '☦️', '🛐', '⛎', '♈️', '♉️', '♊️', '♋️', '♌️', '♍️', '♎️', '♏️', '♐️', '♑️', '♒️', '♓️', '🆔', '⚛️', '🉑', '☢️', '☣️', '📴', '📳', '🈶', '🈚️', '🈸', '🈺', '🈷️', '✴️', '🆚', '💮', '🉐', '㊙️', '㊗️', '🈴', '🈵', '🈹', '🈲', '🅰️', '🅱️', '🆎', '🆑', '🅾️', '🆘', '❌', '⭕️', '🛑', '⛔️', '📛', '🚫', '💯', '💢', '♨️', '🚷', '🚯', '🚳', '🚱', '🔞', '📵', '🚭', '❗️', '❕', '❓', '❔', '‼️', '⁉️', '🔅', '🔆', '〽️', '⚠️', '🚸', '🔱', '⚜️', '🔰', '♻️', '✅', '🈯️', '💹', '❇️', '✳️', '❎', '🌐', '💠', 'Ⓜ️', '🌀', '💤', '🏧', '🚾', '♿️', '🅿️', '🛗', '🈳', '🈂️', '🛂', '🛃', '🛄', '🛅', '🚹', '🚺', '🚼', '⚧', '🚻', '🚮', '🎦', '📶', '🈁', '🔣', 'ℹ️', '🔤', '🔡', '🔠', '🆖', '🆗', '🆙', '🆒', '🆕', '🆓', '0️⃣', '1️⃣', '2️⃣', '3️⃣', '4️⃣', '5️⃣', '6️⃣', '7️⃣', '8️⃣', '9️⃣', '🔟', '🔢', '#️⃣', '*️⃣', '⏏️', '▶️', '⏸', '⏯', '⏹', '⏺', '⏭', '⏮', '⏩', '⏪', '⏫', '⏬', '◀️', '🔼', '🔽', '➡️', '⬅️', '⬆️', '⬇️', '↗️', '↘️', '↙️', '↖️', '↕️', '↔️', '↪️', '↩️', '⤴️', '⤵️', '🔀', '🔁', '🔂', '🔄', '🔃', '🎵', '🎶', '➕', '➖', '➗', '✖️', '♾', '💲', '💱', '™️', '©️', '®️', '〰️', '➰', '➿', '🔚', '🔙', '🔛', '🔝', '🔜', '✔️', '☑️', '🔘', '🔴', '🟠', '🟡', '🟢', '🔵', '🟣', '⚫️', '⚪️', '🟤', '🔺', '🔻', '🔸', '🔹', '🔶', '🔷', '🔳', '🔲', '▪️', '▫️', '◾️', '◽️', '◼️', '◻️', '🟥', '🟧', '🟨', '🟩', '🟦', '🟪', '⬛️', '⬜️', '🟫', '🔈', '🔇', '🔉', '🔊', '🔔', '🔕', '📣', '📢', '👁‍🗨', '💬', '💭', '🗯', '♠️', '♣️', '♥️', '♦️', '🃏', '🎴', '🀄️', '🕐', '🕑', '🕒', '🕓', '🕔', '🕕', '🕖', '🕗', '🕘', '🕙', '🕚', '🕛', '🕜', '🕝', '🕞', '🕟', '🕠', '🕡', '🕢', '🕣', '🕤', '🕥', '🕦', '🕧']
    },
    {
      name: 'Flags',
      icon: '🏳️',
      emojis: ['🏁', '🚩', '🎌', '🏴', '🏳️', '🏳️‍🌈', '🏳️‍⚧️', '🏴‍☠️', '🇦🇫', '🇦🇽', '🇦🇱', '🇩🇿', '🇦🇸', '🇦🇩', '🇦🇴', '🇦🇮', '🇦🇶', '🇦🇬', '🇦🇷', '🇦🇲', '🇦🇼', '🇦🇺', '🇦🇹', '🇦🇿', '🇧🇸', '🇧🇭', '🇧🇩', '🇧🇧', '🇧🇾', '🇧🇪', '🇧🇿', '🇧🇯', '🇧🇲', '🇧🇹', '🇧🇴', '🇧🇦', '🇧🇼', '🇧🇷', '🇮🇴', '🇻🇬', '🇧🇳', '🇧🇬', '🇧🇫', '🇧🇮', '🇰🇭', '🇨🇲', '🇨🇦', '🇮🇨', '🇨🇻', '🇧🇶', '🇰🇾', '🇨🇫', '🇹🇩', '🇨🇱', '🇨🇳', '🇨🇽', '🇨🇨', '🇨🇴', '🇰🇲', '🇨🇬', '🇨🇩', '🇨🇰', '🇨🇷', '🇨🇮', '🇭🇷', '🇨🇺', '🇨🇼', '🇨🇾', '🇨🇿', '🇩🇰', '🇩🇯', '🇩🇲', '🇩🇴', '🇪🇨', '🇪🇬', '🇸🇻', '🇬🇶', '🇪🇷', '🇪🇪', '🇪🇹', '🇪🇺', '🇫🇰', '🇫🇴', '🇫🇯', '🇫🇮', '🇫🇷', '🇬🇫', '🇵🇫', '🇹🇫', '🇬🇦', '🇬🇲', '🇬🇪', '🇩🇪', '🇬🇭', '🇬🇮', '🇬🇷', '🇬🇱', '🇬🇩', '🇬🇵', '🇬🇺', '🇬🇹', '🇬🇬', '🇬🇳', '🇬🇼', '🇬🇾', '🇭🇹', '🇭🇳', '🇭🇰', '🇭🇺', '🇮🇸', '🇮🇳', '🇮🇩', '🇮🇷', '🇮🇶', '🇮🇪', '🇮🇲', '🇮🇱', '🇮🇹', '🇯🇲', '🇯🇵', '🎌', '🇯🇪', '🇯🇴', '🇰🇿', '🇰🇪', '🇰🇮', '🇽🇰', '🇰🇼', '🇰🇬', '🇱🇦', '🇱🇻', '🇱🇧', '🇱🇸', '🇱🇷', '🇱🇾', '🇱🇮', '🇱🇹', '🇱🇺', '🇲🇴', '🇲🇰', '🇲🇬', '🇲🇼', '🇲🇾', '🇲🇻', '🇲🇱', '🇲🇹', '🇲🇭', '🇲🇶', '🇲🇷', '🇲🇺', '🇾🇹', '🇲🇽', '🇫🇲', '🇲🇩', '🇲🇨', '🇲🇳', '🇲🇪', '🇲🇸', '🇲🇦', '🇲🇿', '🇲🇲', '🇳🇦', '🇳🇷', '🇳🇵', '🇳🇱', '🇳🇨', '🇳🇿', '🇳🇮', '🇳🇪', '🇳🇬', '🇳🇺', '🇳🇫', '🇰🇵', '🇲🇵', '🇳🇴', '🇴🇲', '🇵🇰', '🇵🇼', '🇵🇸', '🇵🇦', '🇵🇬', '🇵🇾', '🇵🇪', '🇵🇭', '🇵🇳', '🇵🇱', '🇵🇹', '🇵🇷', '🇶🇦', '🇷🇪', '🇷🇴', '🇷🇺', '🇷🇼', '🇼🇸', '🇸🇲', '🇸🇹', '🇸🇦', '🇸🇳', '🇷🇸', '🇸🇨', '🇸🇱', '🇸🇬', '🇸🇽', '🇸🇰', '🇸🇮', '🇬🇸', '🇸🇧', '🇸🇴', '🇿🇦', '🇰🇷', '🇸🇸', '🇪🇸', '🇱🇰', '🇧🇱', '🇸🇭', '🇰🇳', '🇱🇨', '🇵🇲', '🇻🇨', '🇸🇩', '🇸🇷', '🇸🇿', '🇸🇪', '🇨🇭', '🇸🇾', '🇹🇼', '🇹🇯', '🇹🇿', '🇹🇭', '🇹🇱', '🇹🇬', '🇹🇰', '🇹🇴', '🇹🇹', '🇹🇳', '🇹🇷', '🇹🇲', '🇹🇨', '🇹🇻', '🇻🇮', '🇺🇬', '🇺🇦', '🇦🇪', '🇬🇧', '🏴󠁧󠁢󠁥󠁮󠁧󠁿', '🏴󠁧󠁢󠁳󠁣󠁴󠁿', '🏴󠁧󠁢󠁷󠁬󠁳󠁿', '🇺🇸', '🇺🇾', '🇺🇿', '🇻🇺', '🇻🇦', '🇻🇪', '🇻🇳', '🇼🇫', '🇪🇭', '🇾🇪', '🇿🇲', '🇿🇼']
    }
  ];

  let items = [];

  if (editor.isActive('table')) {
    items = [
      { label: 'Row above', action: () => editor.chain().focus().addRowBefore().run(), icon: '↑' },
      { label: 'Row below', action: () => editor.chain().focus().addRowAfter().run(), icon: '↓' },
      { label: 'Column left', action: () => editor.chain().focus().addColumnBefore().run(), icon: '←' },
      { label: 'Column right', action: () => editor.chain().focus().addColumnAfter().run(), icon: '→' },
      { type: 'divider' },
      { label: 'Bulleted list', action: () => editor.chain().focus().toggleBulletList().run(), icon: '•' },
      { label: 'Numbered list', action: () => editor.chain().focus().toggleOrderedList().run(), icon: '1.' },
      { type: 'divider' },
      { label: 'Quote', action: () => editor.chain().focus().toggleBlockquote().run(), icon: '❝' },
      { label: 'Code block', action: () => editor.chain().focus().toggleCodeBlock().run(), icon: <IconCode /> },
      { type: 'divider' },
      { label: 'Emoji', action: () => setShowEmojiPicker(true), icon: '😊' },
      { label: 'Image', action: handleImageUpload, icon: '🖼️' },
      { label: 'Mention', action: () => { setInputConfig({ type: 'mention' }); setInputValue(''); }, icon: '@' }
    ];
  } else {
    items = [
      { label: 'Paragraph', action: () => editor.chain().focus().setParagraph().run(), icon: 'A≡' },
      { label: 'Heading 1', action: () => editor.chain().focus().toggleHeading({ level: 1 }).run(), icon: 'H1' },
      { label: 'Heading 2', action: () => editor.chain().focus().toggleHeading({ level: 2 }).run(), icon: 'H2' },
      { label: 'Heading 3', action: () => editor.chain().focus().toggleHeading({ level: 3 }).run(), icon: 'H3' },
      { type: 'divider' },
      { label: 'Bulleted list', action: () => editor.chain().focus().toggleBulletList().run(), icon: '•' },
      { label: 'Numbered list', action: () => editor.chain().focus().toggleOrderedList().run(), icon: '1.' },
      { type: 'divider' },
      { label: 'Quote', action: () => editor.chain().focus().toggleBlockquote().run(), icon: '❝' },
      { label: 'Code block', action: () => editor.chain().focus().toggleCodeBlock().run(), icon: <IconCode /> },
      { label: 'Table', action: () => editor.chain().focus().insertTable({ rows: 3, cols: 3, withHeaderRow: true }).run(), icon: '▦' },
      { label: 'Section break', action: () => editor.chain().focus().setHorizontalRule().run(), icon: '—' },
      { type: 'divider' },
      { label: 'Emoji', action: () => setShowEmojiPicker(true), icon: '😊' },
      { label: 'Image', action: handleImageUpload, icon: '🖼️' },
      { label: 'Mention', action: () => { setInputConfig({ type: 'mention' }); setInputValue(''); }, icon: '@' },
      { label: 'Embed link', action: () => { setInputConfig({ type: 'link' }); setInputValue(''); }, icon: '🔗' }
    ];
  }

  const categoryRefs = React.useRef({});

  if (inputConfig) {
    return (
      <div ref={menuRef} style={{ position: 'absolute', top: '100%', left: 0, backgroundColor: '#FFF', border: '1px solid #E5E7EB', borderRadius: '6px', boxShadow: '0 4px 6px -1px rgba(0,0,0,0.1)', zIndex: 99999, width: '280px', padding: '12px', marginTop: '4px' }} onClick={(e) => e.stopPropagation()}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '8px' }}>
          <span style={{ fontSize: '0.8rem', fontWeight: 'bold', color: 'var(--text-secondary)' }}>
            {inputConfig.type === 'mention' ? 'Mention User' : 'Embed Link'}
          </span>
          <button onClick={() => setInputConfig(null)} style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--text-tertiary)' }}>×</button>
        </div>
        <div style={{ display: 'flex', gap: '8px' }}>
          <input
            autoFocus
            type="text"
            placeholder={inputConfig.type === 'mention' ? 'Enter username...' : 'https://example.com'}
            value={inputValue}
            onChange={(e) => setInputValue(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === 'Enter' && inputValue.trim()) {
                if (inputConfig.type === 'mention') {
                  editor.commands.insertContent(`@${inputValue.trim()}`);
                } else {
                  editor.commands.insertContent(`<a href="${inputValue.trim()}" target="_blank">${inputValue.trim()}</a>`);
                }
                onClose();
              }
            }}
            style={{ flex: 1, padding: '4px 8px', border: '1px solid #E5E7EB', borderRadius: '4px', outline: 'none' }}
          />
          <button
            disabled={!inputValue.trim()}
            onClick={() => {
              if (inputConfig.type === 'mention') {
                editor.commands.insertContent(`@${inputValue.trim()}`);
              } else {
                editor.commands.insertContent(`<a href="${inputValue.trim()}" target="_blank">${inputValue.trim()}</a>`);
              }
              onClose();
            }}
            style={{ padding: '4px 8px', background: inputValue.trim() ? 'var(--button-primary-bg)' : '#E5E7EB', color: inputValue.trim() ? 'var(--button-primary-text)' : '#9CA3AF', border: 'none', borderRadius: '4px', cursor: inputValue.trim() ? 'pointer' : 'default' }}
          >
            Add
          </button>
        </div>
      </div>
    );
  }

  if (showEmojiPicker) {
    return (
      <div ref={menuRef} style={{ position: 'absolute', top: '100%', left: 0, backgroundColor: '#FFF', border: '1px solid #E5E7EB', borderRadius: '6px', boxShadow: '0 4px 6px -1px rgba(0,0,0,0.1)', zIndex: 99999, width: '280px', padding: '8px', marginTop: '4px' }} onClick={(e) => e.stopPropagation()}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '8px', paddingBottom: '8px', borderBottom: '1px solid #E5E7EB' }}>
          <div style={{ display: 'flex', gap: '8px' }}>
            {emojiCategories.map(cat => (
              <button
                key={`nav-${cat.name}`}
                title={cat.name}
                onClick={() => categoryRefs.current[cat.name]?.scrollIntoView({ behavior: 'smooth', block: 'start' })}
                style={{ background: 'none', border: 'none', cursor: 'pointer', fontSize: '1.2rem', padding: '0', opacity: 0.6 }}
                onMouseEnter={(e) => e.currentTarget.style.opacity = '1'}
                onMouseLeave={(e) => e.currentTarget.style.opacity = '0.6'}
              >
                {cat.icon}
              </button>
            ))}
          </div>
          <button onClick={() => setShowEmojiPicker(false)} style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--text-tertiary)', padding: 0 }}>×</button>
        </div>
        <div style={{ maxHeight: '250px', overflowY: 'auto', paddingRight: '4px' }}>
          {emojiCategories.map(cat => (
            <div key={cat.name} ref={(el) => categoryRefs.current[cat.name] = el} style={{ marginBottom: '12px', scrollMarginTop: '8px' }}>
              <div style={{ fontSize: '0.8rem', fontWeight: 'bold', color: 'var(--text-secondary)', marginBottom: '6px' }}>{cat.name}</div>
              <div style={{ display: 'flex', flexWrap: 'wrap', gap: '4px' }}>
                {cat.emojis.filter(e => e.length < 5).map(emj => (
                  <button
                    key={emj}
                    onClick={() => { editor.commands.insertContent(emj); onClose(); }}
                    style={{ background: 'none', border: 'none', fontSize: '1.2rem', cursor: 'pointer', padding: '4px', borderRadius: '4px' }}
                    onMouseEnter={(e) => e.currentTarget.style.backgroundColor = 'var(--bg-secondary)'}
                    onMouseLeave={(e) => e.currentTarget.style.backgroundColor = 'transparent'}
                  >
                    {emj}
                  </button>
                ))}
              </div>
            </div>
          ))}
        </div>
      </div>
    );
  }

  return (
    <div ref={menuRef} style={{ position: 'absolute', top: '100%', left: 0, backgroundColor: '#FFF', border: '1px solid #E5E7EB', borderRadius: '6px', boxShadow: '0 4px 6px -1px rgba(0,0,0,0.1)', zIndex: 99999, minWidth: '220px', padding: '8px 0', marginTop: '4px', textAlign: 'left' }}>
      <div style={{ padding: '0 12px', fontSize: '0.75rem', color: '#9CA3AF', marginBottom: '4px' }}>Insert</div>
      {items.map((item, idx) => {
        if (item.type === 'divider') {
          return <div key={idx} style={{ height: '1px', backgroundColor: '#E5E7EB', margin: '4px 0' }} />;
        }
        return (
          <div
            key={idx}
            style={{ padding: '6px 12px', fontSize: '0.9rem', color: '#374151', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '8px' }}
            onClick={(e) => {
              e.stopPropagation();
              if (item.label !== 'Emoji') {
                item.action();
                if (item.label !== 'Image' && item.label !== 'Mention' && item.label !== 'Embed link') onClose();
              } else {
                item.action();
              }
            }}
            onMouseEnter={(e) => e.currentTarget.style.backgroundColor = '#F3F4F6'}
            onMouseLeave={(e) => e.currentTarget.style.backgroundColor = 'transparent'}
          >
            <span style={{ color: '#6B7280', fontSize: '1rem', width: '24px', textAlign: 'center', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>{item.icon}</span>
            {item.label}
          </div>
        )
      })}
    </div>
  )
}

export default function ProjectNoteView({ selectedProject, isReadOnly, activeViewObj, onUpdateNote }) {
  const [title, setTitle] = useState(activeViewObj?.noteTitle || 'Untitled Note');
  const [content, setContent] = useState(activeViewObj?.content || '');
  const [showTemplates, setShowTemplates] = useState(true);
  const [isToolbarMenuOpen, setIsToolbarMenuOpen] = useState(false);
  const [isEditorMenuOpen, setIsEditorMenuOpen] = useState(false);

  const editor = useEditor({
    extensions: [
      StarterKit,
      Underline,
      Highlight,
      Image.configure({
        inline: true,
        allowBase64: true,
      }),
      Link.configure({
        openOnClick: false,
        autolink: true,
      }),
      Placeholder.configure({
        placeholder: 'Start typing or type / for menu',
        emptyEditorClass: 'is-editor-empty',
      }),
      Table.configure({
        resizable: true,
      }),
      TableRow,
      TableHeader,
      TableCell,
      GithubPRExtension,
    ],
    content: activeViewObj?.content || '',
    onUpdate: ({ editor }) => {
      const html = editor.getHTML();
      setContent(html);
      if (editor.getText().trim().length > 0) {
        setShowTemplates(false);
      } else {
        setShowTemplates(true);
      }
    },
    editable: !isReadOnly
  });

  // Sync when activeViewObj changes externally (e.g. tab switch)
  useEffect(() => {
    if (activeViewObj) {
      const incomingTitle = activeViewObj.noteTitle || 'Untitled Note';
      if (incomingTitle !== title) setTitle(incomingTitle);
      const newContent = activeViewObj.content || '';
      if (newContent !== content) {
        setContent(newContent);
        if (editor && editor.getHTML() !== newContent) {
          editor.commands.setContent(newContent);
          setShowTemplates(editor.getText().trim().length === 0);
        }
      }
    }
  }, [activeViewObj?.id, editor]);

  // Initialize showTemplates correctly when editor mounts
  useEffect(() => {
    if (editor) {
      setShowTemplates(editor.getText().trim().length === 0);
    }
  }, [editor]);

  // Debounced save
  useEffect(() => {
    if (!onUpdateNote || !activeViewObj) return;
    const timeoutId = setTimeout(() => {
      const currentName = activeViewObj.noteTitle || 'Untitled Note';
      const currentContent = activeViewObj.content || '';
      if (title !== currentName || content !== currentContent) {
        onUpdateNote(title, content);
      }
    }, 1500);
    return () => clearTimeout(timeoutId);
  }, [title, content, activeViewObj, onUpdateNote]);

  const templateButtons = [
    { icon: '📅', label: 'Meeting notes' },
    { icon: '📋', label: 'Project background' },
    { icon: '🔗', label: 'Key resources' },
    { icon: '✅', label: 'Weekly planning' },
    { icon: '📄', label: 'Blank note' }
  ];

  const btnStyle = (isActive) => ({
    padding: '4px 6px',
    background: isActive ? 'rgba(0,0,0,0.05)' : 'transparent',
    border: 'none',
    borderRadius: '4px',
    cursor: 'pointer',
    color: '#64748B',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    transition: 'background-color 0.2s',
  });

  const dividerStyle = {
    width: '1px',
    height: '20px',
    backgroundColor: '#E2E8F0',
    margin: '0 4px',
  };

  return (
    <div style={{ flex: 1, display: 'flex', flexDirection: 'column', backgroundColor: '#FFF', height: '100%', overflow: 'hidden' }}>
      <style>{`
        .note-editor-wrapper .ProseMirror p.is-editor-empty:first-child::before {
          content: attr(data-placeholder);
          float: left;
          color: #9CA3AF;
          pointer-events: none;
          height: 0;
        }
        .note-editor-wrapper .ProseMirror { outline: none; min-height: 150px; font-size: 1.05rem; line-height: 1.6; }
        .note-editor-wrapper .ProseMirror pre {
          background: #F1F2F4;
          border-radius: 6px;
          padding: 16px;
          color: #374151;
          font-family: 'Consolas', 'Monaco', 'Courier New', monospace;
          font-size: 0.9rem;
          margin: 1rem 0;
          overflow-x: auto;
        }
        .note-editor-wrapper .ProseMirror pre code {
          background: none;
          padding: 0;
          color: inherit;
          font-size: inherit;
          border: none;
        }
        .note-editor-wrapper .ProseMirror code {
          background: #F3F4F6;
          border: 1px solid #D1D5DB;
          border-radius: 4px;
          padding: 2px 4px;
          font-family: 'Consolas', 'Monaco', 'Courier New', monospace;
          font-size: 0.9em;
        }
        .note-editor-wrapper .ProseMirror img {
          max-width: 100%;
          height: auto;
          border-radius: 6px;
        }
        .note-editor-wrapper .ProseMirror table {
          border-collapse: collapse;
          table-layout: fixed;
          width: 100%;
          margin: 0;
          overflow: hidden;
        }
        .note-editor-wrapper .ProseMirror table td,
        .note-editor-wrapper .ProseMirror table th {
          min-width: 1em;
          border: 1px solid #E2E8F0;
          padding: 3px 5px;
          vertical-align: top;
          box-sizing: border-box;
          position: relative;
        }
        .note-editor-wrapper .ProseMirror table th {
          font-weight: bold;
          text-align: left;
          background-color: #F8FAFC;
        }
      `}</style>

      {/* Top Toolbar */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '8px 16px', borderBottom: '1px solid var(--border-color)', backgroundColor: 'var(--bg-primary)' }}>
        <div style={{ display: 'flex', gap: '4px', alignItems: 'center' }}>
          <div style={{ position: 'relative' }}>
            <button type="button" style={btnStyle(isToolbarMenuOpen)} title="Add" onClick={() => setIsToolbarMenuOpen(!isToolbarMenuOpen)}><IconPlus /></button>
            {isToolbarMenuOpen && (
              <>
                <div style={{ position: 'fixed', inset: 0, zIndex: 99 }} onClick={(e) => { e.stopPropagation(); setIsToolbarMenuOpen(false); }} />
                <InsertMenu editor={editor} onClose={() => setIsToolbarMenuOpen(false)} />
              </>
            )}
          </div>
          <div style={dividerStyle}></div>
          <button type="button" onClick={() => editor?.chain().focus().undo().run()} disabled={!editor?.can().undo()} style={{ ...btnStyle(), opacity: editor?.can().undo() ? 1 : 0.5 }} title="Undo"><IconUndo /></button>
          <button type="button" onClick={() => editor?.chain().focus().redo().run()} disabled={!editor?.can().redo()} style={{ ...btnStyle(), opacity: editor?.can().redo() ? 1 : 0.5 }} title="Redo"><IconRedo /></button>
          <div style={dividerStyle}></div>
          <button type="button" onClick={() => editor?.chain().focus().toggleBold().run()} style={btnStyle(editor?.isActive('bold'))} title="Bold"><IconBold /></button>
          <button type="button" onClick={() => editor?.chain().focus().toggleItalic().run()} style={btnStyle(editor?.isActive('italic'))} title="Italic"><IconItalic /></button>
          <button type="button" onClick={() => editor?.chain().focus().toggleUnderline().run()} style={btnStyle(editor?.isActive('underline'))} title="Underline"><IconUnderline /></button>
          <button type="button" onClick={() => editor?.chain().focus().toggleHighlight().run()} style={btnStyle(editor?.isActive('highlight'))} title="Highlight"><IconMarker /></button>
          <button type="button" onClick={() => editor?.chain().focus().toggleStrike().run()} style={btnStyle(editor?.isActive('strike'))} title="Strikethrough"><IconStrikethrough /></button>
          <button type="button" onClick={() => editor?.chain().focus().toggleBulletList().run()} style={btnStyle(editor?.isActive('bulletList'))} title="Bullet List"><IconBulletList /></button>
          <button type="button" onClick={() => editor?.chain().focus().toggleOrderedList().run()} style={btnStyle(editor?.isActive('orderedList'))} title="Numbered List"><IconOrderedList /></button>
          <button type="button" style={btnStyle()} title="Link"><IconLink /></button>
          <button type="button" onClick={() => editor?.chain().focus().toggleCodeBlock().run()} style={btnStyle(editor?.isActive('codeBlock'))} title="Code Block"><IconCode /></button>
          <button type="button" onClick={() => editor?.chain().focus().toggleBlockquote().run()} style={btnStyle(editor?.isActive('blockquote'))} title="Quote"><IconQuote /></button>
          <button type="button" style={btnStyle()} title="Magic Wand"><IconMagicWand /></button>
          <div style={dividerStyle}></div>
          <button type="button" style={{ ...btnStyle(), padding: '4px 8px', gap: '6px', fontSize: '0.85rem', color: '#9CA3AF' }} disabled>
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M22 11.08V12a10 10 0 1 1-5.93-9.14"></path><polyline points="22 4 12 14.01 9 11.01"></polyline></svg>
            Create task
          </button>
        </div>
        <div style={{ display: 'flex', gap: '16px', alignItems: 'center' }}>
          <span style={{ fontSize: '0.85rem', color: 'var(--text-secondary)' }}>All edits will be auto-saved</span>
          <button type="button" style={btnStyle()} title="Search"><IconSearch /></button>
        </div>
      </div>

      {/* Main Content Area */}
      <div style={{ flex: 1, display: 'flex', overflowY: 'auto', position: 'relative' }}>
        {/* Left menu icon */}
        <div style={{ padding: '24px 16px', color: 'var(--text-secondary)' }}>
          <IconMenu />
        </div>

        {/* Editor Container */}
        <div style={{ flex: 1, display: 'flex', justifyContent: 'center', padding: '40px 0' }}>
          <div style={{ width: '100%', maxWidth: '800px', padding: '0 20px', display: 'flex', flexDirection: 'column' }}>
            <input
              type="text"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              readOnly={isReadOnly}
              style={{
                fontSize: '2.2rem',
                fontWeight: '400',
                color: 'var(--text-primary)',
                border: 'none',
                outline: 'none',
                width: '100%',
                marginBottom: '24px',
                backgroundColor: 'transparent',
                textAlign: 'center'
              }}
            />

            <div className="note-editor-wrapper" style={{ position: 'relative' }}>
              {editor && (
                <FloatingMenu editor={editor} tippyOptions={{ duration: 100, placement: 'left' }}>
                  <div style={{ position: 'relative', display: 'flex', alignItems: 'center' }}>
                    <button
                      onClick={(e) => {
                        e.stopPropagation();
                        setIsEditorMenuOpen(!isEditorMenuOpen);
                      }}
                      style={{
                        background: 'none',
                        border: 'none',
                        cursor: 'pointer',
                        color: 'var(--text-tertiary)',
                        fontSize: '1.5rem',
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        padding: '0 8px',
                        transform: 'translate(-50px, -2px)'
                      }}
                    >
                      +
                    </button>
                    {isEditorMenuOpen && (
                      <div style={{ position: 'absolute', left: '100%', top: '0', zIndex: 99999 }}>
                        <div style={{ position: 'fixed', inset: 0, zIndex: 99998, cursor: 'default' }} onClick={(e) => { e.stopPropagation(); setIsEditorMenuOpen(false); }} />
                        <InsertMenu editor={editor} onClose={() => setIsEditorMenuOpen(false)} />
                      </div>
                    )}
                  </div>
                </FloatingMenu>
              )}
              {editor && (
                <BubbleMenu
                  editor={editor}
                  tippyOptions={{ duration: 100, placement: 'top-end', offset: [0, 0] }}
                  shouldShow={({ editor }) => editor.isActive('image') || editor.isActive('table')}
                >
                  <button
                    onClick={() => {
                      if (editor.isActive('image')) {
                        editor.commands.deleteSelection();
                      } else if (editor.isActive('table')) {
                        editor.commands.deleteTable();
                      }
                    }}
                    style={{
                      background: '#FFF',
                      border: '1px solid #E2E8F0',
                      borderRadius: '50%',
                      width: '28px',
                      height: '28px',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      cursor: 'pointer',
                      boxShadow: '0 2px 6px rgba(0,0,0,0.15)',
                      color: '#EF4444',
                      fontSize: '18px',
                      fontWeight: 'bold',
                      padding: 0,
                      lineHeight: 1,
                      transform: 'translate(50%, 50%)'
                    }}
                    title="Delete"
                    onMouseEnter={(e) => {
                      e.currentTarget.style.background = '#FEE2E2';
                    }}
                    onMouseLeave={(e) => {
                      e.currentTarget.style.background = '#FFF';
                    }}
                  >
                    ×
                  </button>
                </BubbleMenu>
              )}
              <EditorContent editor={editor} />

              {showTemplates && (
                <div style={{ display: 'flex', flexWrap: 'wrap', gap: '0.75rem', marginTop: '16px', paddingLeft: '0px' }}>
                  {templateButtons.map((btn, i) => (
                    <button
                      key={i}
                      onClick={() => {
                        if (editor) {
                          editor.commands.setContent(`<p>${btn.label} Template</p>`);
                          editor.commands.focus('end');
                        }
                      }}
                      style={{
                        display: 'flex',
                        alignItems: 'center',
                        gap: '0.5rem',
                        padding: '6px 12px',
                        backgroundColor: '#FFF',
                        border: '1px solid var(--border-color)',
                        borderRadius: '6px',
                        cursor: 'pointer',
                        fontSize: '0.85rem',
                        color: 'var(--text-primary)',
                        transition: 'box-shadow 0.2s',
                        boxShadow: '0 1px 2px rgba(0,0,0,0.05)'
                      }}
                      onMouseEnter={(e) => e.currentTarget.style.boxShadow = '0 4px 6px rgba(0,0,0,0.05)'}
                      onMouseLeave={(e) => e.currentTarget.style.boxShadow = '0 1px 2px rgba(0,0,0,0.05)'}
                    >
                      <span style={{ fontSize: '1rem', color: 'var(--text-secondary)' }}>{btn.icon}</span> {btn.label}
                    </button>
                  ))}
                </div>
              )}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
