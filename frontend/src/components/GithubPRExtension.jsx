import React, { useEffect, useState } from 'react';
import { Node, mergeAttributes, nodePasteRule, nodeInputRule } from '@tiptap/core';
import { apiFetch } from '../api';
import { ReactNodeViewRenderer, NodeViewWrapper } from '@tiptap/react';

const GITHUB_PR_REGEX = /https:\/\/github\.com\/([^\/]+)\/([^\/]+)\/pull\/(\d+)/g;
const GITHUB_PR_INPUT_REGEX = /(?:^|\s)(https:\/\/github\.com\/[^\/]+\/[^\/]+\/pull\/\d+)\s$/;

const GithubPRNodeView = (props) => {
  const { url } = props.node.attrs;
  const [prData, setPrData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  useEffect(() => {
    if (!url) {
      setLoading(false);
      return;
    }
    
    const fetchPR = async () => {
      try {
        setLoading(true);
        const response = await apiFetch('/api/github/pr', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ url })
        });
        
        if (!response.ok) {
          throw new Error('Failed to fetch PR');
        }
        
        const data = await response.json();
        setPrData(data);
      } catch (err) {
        setError(err.message);
      } finally {
        setLoading(false);
      }
    };
    
    fetchPR();
  }, [url]);

  const cardStyle = {
    display: 'flex',
    flexDirection: 'column',
    border: '1px solid #d0d7de',
    borderRadius: '6px',
    backgroundColor: '#ffffff',
    margin: '8px 0',
    fontFamily: '-apple-system, BlinkMacSystemFont, "Segoe UI", Helvetica, Arial, sans-serif',
    userSelect: 'none',
    contentEditable: false,
  };

  const headerStyle = {
    display: 'flex',
    padding: '16px 16px 12px 16px',
    gap: '12px',
  };

  const titleStyle = {
    fontWeight: '600',
    fontSize: '1rem',
    color: '#24292f',
    margin: 0,
    lineHeight: '1.2'
  };

  const subtitleStyle = {
    display: 'flex',
    alignItems: 'center',
    gap: '6px',
    fontSize: '0.85rem',
    color: '#57606a',
    marginTop: '6px'
  };

  const dividerStyle = {
    height: '1px',
    backgroundColor: '#e1e4e8',
    margin: '0 16px'
  };

  const gridStyle = {
    display: 'flex',
    padding: '12px 16px',
    gap: '32px'
  };

  const colStyle = {
    display: 'flex',
    flexDirection: 'column',
    gap: '4px'
  };

  const colHeaderStyle = {
    fontSize: '0.75rem',
    color: '#8c959f',
    fontWeight: '400'
  };

  const colValueStyle = {
    fontSize: '0.9rem',
    color: '#24292f',
    fontWeight: '500',
    display: 'flex',
    alignItems: 'center',
    gap: '6px'
  };

  const footerStyle = {
    fontSize: '0.75rem',
    color: '#8c959f',
    padding: '12px 16px',
  };
  
  const dotStyle = {
    width: '8px',
    height: '8px',
    borderRadius: '50%',
    display: 'inline-block',
  };

  const formatReviewStatus = (status) => {
    if (!status || status === 'No reviews') return 'No reviews';
    return status;
  };

  if (loading) {
    return (
      <NodeViewWrapper as="div" style={cardStyle} contentEditable={false}>
        <div style={{ padding: '16px', color: '#57606a', fontSize: '0.9rem' }}>
          Loading PR data...
        </div>
      </NodeViewWrapper>
    );
  }

  if (error || !prData) {
    return (
      <NodeViewWrapper as="div" style={cardStyle} contentEditable={false}>
         <div style={{ padding: '16px' }}>
           <a href={url} target="_blank" rel="noopener noreferrer" style={{ color: '#0969da', textDecoration: 'none' }}>{url}</a>
           <div style={{ color: '#cf222e', fontSize: '0.85rem', marginTop: '4px' }}>{error || 'Could not load PR'}</div>
         </div>
      </NodeViewWrapper>
    );
  }

  // Format Date (e.g. "20 Jul at 14:29")
  let dateStr = '';
  if (prData.createdAt) {
    const d = new Date(prData.createdAt);
    const day = d.getDate();
    const month = d.toLocaleString('en-US', { month: 'short' });
    const time = d.toLocaleString('en-US', { hour: '2-digit', minute: '2-digit', hour12: false });
    dateStr = `${day} ${month} at ${time}`;
  }

  return (
    <NodeViewWrapper as="div" style={cardStyle} contentEditable={false}>
      <div style={headerStyle}>
        <svg height="20" width="20" viewBox="0 0 16 16" fill="#24292f" style={{ marginTop: '2px' }}>
          <path fillRule="evenodd" d="M8 0C3.58 0 0 3.58 0 8c0 3.54 2.29 6.53 5.47 7.59.4.07.55-.17.55-.38 0-.19-.01-.82-.01-1.49-2.01.37-2.53-.49-2.69-.94-.09-.23-.48-.94-.82-1.13-.28-.15-.68-.52-.01-.53.63-.01 1.08.58 1.23.82.72 1.21 1.87.87 2.33.66.07-.52.28-.87.51-1.07-1.78-.2-3.64-.89-3.64-3.95 0-.87.31-1.59.82-2.15-.08-.2-.36-1.02.08-2.12 0 0 .67-.21 2.2.82.64-.18 1.32-.27 2-.27.68 0 1.36.09 2 .27 1.53-1.04 2.2-.82 2.2-.82.44 1.1.16 1.92.08 2.12.51.56.82 1.27.82 2.15 0 3.07-1.87 3.75-3.65 3.95.29.25.54.73.54 1.48 0 1.07-.01 1.93-.01 2.2 0 .21.15.46.55.38A8.013 8.013 0 0016 8c0-4.42-3.58-8-8-8z"></path>
        </svg>
        <div style={{ flex: 1 }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
            <h4 style={titleStyle}>#{prData.number} {prData.title}</h4>
          </div>
          <div style={subtitleStyle}>
            <svg width="14" height="14" viewBox="0 0 16 16" fill="#57606a">
              <path fillRule="evenodd" d="M7.177 3.073L9.573.677A.25.25 0 0110 .854v4.792a.25.25 0 01-.427.177L7.177 3.427a.25.25 0 010-.354zM3.75 2.5a.75.75 0 100 1.5.75.75 0 000-1.5zm-2.25.75a2.25 2.25 0 113 2.122v5.256a2.25 2.25 0 11-1.5 0V5.372A2.25 2.25 0 011.5 3.25zM11 2.5h-1V4h1a1 1 0 011 1v5.628a2.25 2.25 0 101.5 0V5A2.5 2.5 0 0011 2.5zm1 10.25a.75.75 0 111.5 0 .75.75 0 01-1.5 0zM3.75 12a.75.75 0 100 1.5.75.75 0 000-1.5z"></path>
            </svg>
            Pull request in {prData.owner}/{prData.repo} • <a href={prData.url} target="_blank" rel="noopener noreferrer" style={{ color: '#57606a', textDecoration: 'none' }}>View in GitHub</a>
          </div>
        </div>
      </div>
      
      <div style={dividerStyle} />
      
      <div style={gridStyle}>
        <div style={colStyle}>
          <div style={colHeaderStyle}>Review status</div>
          <div style={colValueStyle}>{formatReviewStatus(prData.reviewStatus)}</div>
        </div>
        <div style={colStyle}>
          <div style={colHeaderStyle}>PR status</div>
          <div style={colValueStyle}>{prData.state === 'closed' ? (prData.merged ? 'Merged' : 'Closed') : (prData.draft ? 'Draft' : 'Open')}</div>
        </div>
        <div style={colStyle}>
          <div style={colHeaderStyle}>Line changes</div>
          <div style={colValueStyle}>
             <span style={{ ...dotStyle, backgroundColor: '#2da44e' }}></span> +{prData.additions}
             <span style={{ ...dotStyle, backgroundColor: '#cf222e', marginLeft: '8px' }}></span> -{prData.deletions}
          </div>
        </div>
      </div>

      <div style={dividerStyle} />

      <div style={footerStyle}>
        Created in GitHub {dateStr}
      </div>
    </NodeViewWrapper>
  );
};

export const GithubPRExtension = Node.create({
  name: 'githubPr',
  group: 'block',
  atom: true,

  addAttributes() {
    return {
      url: {
        default: null,
      },
    };
  },

  parseHTML() {
    return [
      {
        tag: 'div[data-github-pr]',
      },
      {
        tag: 'a[href]',
        getAttrs: (element) => {
          if (typeof element === 'string') return false;
          const href = element.getAttribute('href');
          if (href && href.match(/^https:\/\/github\.com\/[^\/]+\/[^\/]+\/pull\/\d+$/)) {
            return { url: href };
          }
          return false;
        },
      }
    ];
  },

  renderHTML({ HTMLAttributes }) {
    return ['div', mergeAttributes(HTMLAttributes, { 'data-github-pr': true })];
  },

  addNodeView() {
    return ReactNodeViewRenderer(GithubPRNodeView);
  },

  addInputRules() {
    return [
      nodeInputRule({
        find: GITHUB_PR_INPUT_REGEX,
        type: this.type,
        getAttributes: match => {
          return { url: match[1] }; // match[1] is the captured URL
        },
      }),
    ];
  },

  addPasteRules() {
    return [
      nodePasteRule({
        find: GITHUB_PR_REGEX,
        type: this.type,
        getAttributes: match => {
          return { url: match[0] };
        },
      }),
    ];
  },
});
