import React, { forwardRef, useEffect, useImperativeHandle, useState } from 'react';
import { useEditor, EditorContent, ReactRenderer } from '@tiptap/react';
import StarterKit from '@tiptap/starter-kit';
import Mention from '@tiptap/extension-mention';
import Placeholder from '@tiptap/extension-placeholder';
import Underline from '@tiptap/extension-underline';
import Highlight from '@tiptap/extension-highlight';
import tippy from 'tippy.js';
import { GithubPRExtension } from './GithubPRExtension';

// ---- Mention Dropdown UI ----
const MentionList = forwardRef((props, ref) => {
  const [selectedIndex, setSelectedIndex] = useState(0);

  const selectItem = (index) => {
    const item = props.items[index];
    if (item) {
      props.command({ id: item.id, label: item.name });
    }
  };

  const upHandler = () => {
    setSelectedIndex((selectedIndex + props.items.length - 1) % props.items.length);
  };

  const downHandler = () => {
    setSelectedIndex((selectedIndex + 1) % props.items.length);
  };

  const enterHandler = () => {
    selectItem(selectedIndex);
  };

  useEffect(() => setSelectedIndex(0), [props.items]);

  useImperativeHandle(ref, () => ({
    onKeyDown: ({ event }) => {
      if (event.key === 'ArrowUp') {
        upHandler();
        return true;
      }
      if (event.key === 'ArrowDown') {
        downHandler();
        return true;
      }
      if (event.key === 'Enter') {
        enterHandler();
        return true;
      }
      return false;
    },
  }));

  return (
    <div style={{ background: 'var(--bg-primary)', border: '1px solid var(--border-color)', borderRadius: '6px', boxShadow: '0 4px 12px rgba(0,0,0,0.1)', overflow: 'hidden', minWidth: '150px' }}>
      {props.items.length ? (
        props.items.map((item, index) => (
          <button
            key={item.id}
            onClick={() => selectItem(index)}
            style={{
              display: 'block',
              width: '100%',
              padding: '8px 12px',
              border: 'none',
              background: index === selectedIndex ? 'var(--bg-secondary)' : 'transparent',
              color: 'var(--text-primary)',
              textAlign: 'left',
              cursor: 'pointer',
              fontSize: '0.9rem'
            }}
          >
            {item.name}
          </button>
        ))
      ) : (
        <div style={{ padding: '8px 12px', color: 'var(--text-secondary)', fontSize: '0.9rem' }}>No results</div>
      )}
    </div>
  );
});

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
const IconIndent = () => <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><line x1="21" y1="6" x2="11" y2="6"></line><line x1="21" y1="12" x2="11" y2="12"></line><line x1="21" y1="18" x2="11" y2="18"></line><polyline points="3 8 7 12 3 16"></polyline></svg>;
const IconLink = () => <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M10 13a5 5 0 0 0 7.54.54l3-3a5 5 0 0 0-7.07-7.07l-1.72 1.71"></path><path d="M14 11a5 5 0 0 0-7.54-.54l-3 3a5 5 0 0 0 7.07 7.07l1.71-1.71"></path></svg>;
const IconCode = () => <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><polyline points="16 18 22 12 16 6"></polyline><polyline points="8 6 2 12 8 18"></polyline></svg>;
const IconQuote = () => <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M21 11.5a8.38 8.38 0 0 1-.9 3.8 8.5 8.5 0 0 1-7.6 4.7 8.38 8.38 0 0 1-3.8-.9L3 21l1.9-5.7a8.38 8.38 0 0 1-.9-3.8 8.5 8.5 0 0 1 4.7-7.6 8.38 8.38 0 0 1 3.8-.9h.5a8.48 8.48 0 0 1 8 8v.5z"></path></svg>;
const IconMagicWand = () => <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M20.9 14.5A2.9 2.9 0 0 0 23 12a2.9 2.9 0 0 0-2.1-2.5l-.2-.1A2.9 2.9 0 0 0 19 8.1l-.1-.2A2.9 2.9 0 0 0 17 6c-1.3 0-2.4 1-2.5 2.2l-.1.2A2.9 2.9 0 0 0 13 9.7l-.2.1A2.9 2.9 0 0 0 11 12a2.9 2.9 0 0 0 1.9 2.4l.2.1A2.9 2.9 0 0 0 14.6 16l.1.2A2.9 2.9 0 0 0 17 18a2.9 2.9 0 0 0 2.4-1.9l.1-.2A2.9 2.9 0 0 0 20.7 14.6l.2-.1z" /><path d="m3 21 6.5-6.5" /></svg>;

// ---- Rich Text Editor Component ----
export default function RichTextEditor({ value, onChange, onBlur, placeholder = 'Type / for menu', users = [], minHeight = '120px', autoFocus = false }) {
  const editor = useEditor({
    extensions: [
      StarterKit,
      Underline,
      Highlight,
      GithubPRExtension,
      Placeholder.configure({
        placeholder: placeholder,
        emptyEditorClass: 'is-editor-empty',
      }),
      Mention.configure({
        HTMLAttributes: {
          class: 'mention',
          style: 'color: #4F46E5; background: #EEF2FF; padding: 2px 4px; border-radius: 4px; font-weight: 500;',
        },
        suggestion: {
          items: ({ query }) => {
            return users
              .filter(user => user.name.toLowerCase().startsWith(query.toLowerCase()))
              .slice(0, 5);
          },
          render: () => {
            let component;
            let popup;

            return {
              onStart: (props) => {
                component = new ReactRenderer(MentionList, {
                  props,
                  editor: props.editor,
                });

                if (!props.clientRect) return;

                popup = tippy('body', {
                  getReferenceClientRect: props.clientRect,
                  appendTo: () => document.body,
                  content: component.element,
                  showOnCreate: true,
                  interactive: true,
                  trigger: 'manual',
                  placement: 'bottom-start',
                });
              },
              onUpdate(props) {
                component.updateProps(props);

                if (!props.clientRect) return;

                popup[0].setProps({
                  getReferenceClientRect: props.clientRect,
                });
              },
              onKeyDown(props) {
                if (props.event.key === 'Escape') {
                  popup[0].hide();
                  return true;
                }
                return component.ref?.onKeyDown(props);
              },
              onExit() {
                if (popup && popup[0]) {
                  popup[0].destroy();
                }
                if (component) {
                  component.destroy();
                }
              },
            };
          },
        },
      }),
    ],
    content: value || '',
    onUpdate: ({ editor }) => {
      onChange(editor.getHTML());
    },
    onBlur: () => {
      if (onBlur) onBlur();
    }
  });

  useEffect(() => {
    if (editor && value !== editor.getHTML()) {
      editor.commands.setContent(value || '');
    }
  }, [value, editor]);

  useEffect(() => {
    if (editor && autoFocus) {
      editor.commands.focus('end');
    }
  }, [editor, autoFocus]);

  if (!editor) return null;

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
    <div style={{ border: '1px solid #D1D5DB', borderRadius: '8px', overflow: 'hidden', backgroundColor: 'var(--bg-primary)', display: 'flex', flexDirection: 'column' }}>

      <style>{`
        .ProseMirror p.is-editor-empty:first-child::before {
          content: attr(data-placeholder);
          float: left;
          color: #9CA3AF;
          pointer-events: none;
          height: 0;
        }
        .ProseMirror { outline: none; }
      `}</style>

      <div style={{ padding: '12px 16px', minHeight: minHeight, cursor: 'text', color: 'var(--text-primary)', fontSize: '0.95rem' }} onClick={() => editor.chain().focus().run()}>
        <EditorContent editor={editor} />
      </div>

      <div style={{ padding: '8px 12px', display: 'flex', gap: '4px', backgroundColor: 'var(--bg-primary)', alignItems: 'center', borderTop: '1px solid transparent' }}>
        <button type="button" style={btnStyle()} title="Add"><IconPlus /></button>
        <div style={dividerStyle}></div>
        <button type="button" onClick={() => editor.chain().focus().undo().run()} disabled={!editor.can().undo()} style={{ ...btnStyle(), opacity: editor.can().undo() ? 1 : 0.5 }} title="Undo"><IconUndo /></button>
        <button type="button" onClick={() => editor.chain().focus().redo().run()} disabled={!editor.can().redo()} style={{ ...btnStyle(), opacity: editor.can().redo() ? 1 : 0.5 }} title="Redo"><IconRedo /></button>
        <div style={dividerStyle}></div>
        <button type="button" onClick={() => editor.chain().focus().toggleBold().run()} style={btnStyle(editor.isActive('bold'))} title="Bold"><IconBold /></button>
        <button type="button" onClick={() => editor.chain().focus().toggleItalic().run()} style={btnStyle(editor.isActive('italic'))} title="Italic"><IconItalic /></button>
        <button type="button" onClick={() => editor.chain().focus().toggleUnderline().run()} style={btnStyle(editor.isActive('underline'))} title="Underline"><IconUnderline /></button>
        <button type="button" onClick={() => editor.chain().focus().toggleHighlight().run()} style={btnStyle(editor.isActive('highlight'))} title="Highlight"><IconMarker /></button>
        <button type="button" onClick={() => editor.chain().focus().toggleStrike().run()} style={btnStyle(editor.isActive('strike'))} title="Strikethrough"><IconStrikethrough /></button>
        <button type="button" onClick={() => editor.chain().focus().toggleBulletList().run()} style={btnStyle(editor.isActive('bulletList'))} title="Bullet List"><IconBulletList /></button>
        <button type="button" onClick={() => editor.chain().focus().toggleOrderedList().run()} style={btnStyle(editor.isActive('orderedList'))} title="Numbered List"><IconOrderedList /></button>
        <button type="button" style={btnStyle()} title="Indent"><IconIndent /></button>
        <button type="button" style={btnStyle()} title="Link"><IconLink /></button>
        <button type="button" onClick={() => editor.chain().focus().toggleCodeBlock().run()} style={btnStyle(editor.isActive('codeBlock'))} title="Code Block"><IconCode /></button>
        <button type="button" onClick={() => editor.chain().focus().toggleBlockquote().run()} style={btnStyle(editor.isActive('blockquote'))} title="Quote"><IconQuote /></button>
        <button type="button" style={btnStyle()} title="Magic Wand"><IconMagicWand /></button>

        <div style={dividerStyle}></div>

        <button type="button" style={{ ...btnStyle(), padding: '4px 8px', gap: '6px', fontSize: '0.85rem', color: '#9CA3AF' }} disabled>
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M22 11.08V12a10 10 0 1 1-5.93-9.14"></path><polyline points="22 4 12 14.01 9 11.01"></polyline></svg>
          Create task
        </button>
      </div>

    </div>
  );
}
