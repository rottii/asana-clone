const express = require('express');
const router = express.Router();

router.post('/pr', async (req, res) => {
  const { url } = req.body;
  if (!url) {
    return res.status(400).json({ error: 'GitHub PR URL is required' });
  }

  try {
    // Parse URL: https://github.com/:owner/:repo/pull/:number
    let cleanedUrl = url.trim();
    if (cleanedUrl.endsWith('/')) {
      cleanedUrl = cleanedUrl.slice(0, -1);
    }
    const parts = cleanedUrl.split('/');
    const pullIndex = parts.indexOf('pull');
    
    if (pullIndex === -1 || parts.length < pullIndex + 2) {
      return res.status(400).json({ error: 'Invalid GitHub PR URL format. Must be https://github.com/owner/repo/pull/123' });
    }

    const number = parts[pullIndex + 1];
    const repo = parts[pullIndex - 1];
    const owner = parts[pullIndex - 2];

    const apiUrl = `https://api.github.com/repos/${owner}/${repo}/pulls/${number}`;
    
    // Use native fetch (Node 18+)
    const response = await fetch(apiUrl, {
      headers: {
        'Accept': 'application/vnd.github.v3+json',
        'User-Agent': 'Asana-Clone-App',
        ...(process.env.GITHUB_TOKEN && { 'Authorization': `Bearer ${process.env.GITHUB_TOKEN}` })
      }
    });

    if (!response.ok) {
      if (response.status === 404) {
         return res.status(404).json({ error: 'Pull request not found or repository is private.' });
      }
      if (response.status === 403) {
         return res.status(403).json({ error: 'GitHub API rate limit exceeded.' });
      }
      return res.status(response.status).json({ error: 'Failed to fetch from GitHub API' });
    }

    const data = await response.json();

    // Fetch reviews to determine review status
    let reviewStatus = 'No reviews';
    try {
      const reviewsResponse = await fetch(`${apiUrl}/reviews`, {
        headers: {
          'Accept': 'application/vnd.github.v3+json',
          'User-Agent': 'Asana-Clone-App',
          ...(process.env.GITHUB_TOKEN && { 'Authorization': `Bearer ${process.env.GITHUB_TOKEN}` })
        }
      });
      if (reviewsResponse.ok) {
        const reviews = await reviewsResponse.json();
        if (reviews && reviews.length > 0) {
          const states = reviews.map(r => r.state);
          if (states.includes('CHANGES_REQUESTED')) {
            reviewStatus = 'Changes requested';
          } else if (states.includes('APPROVED')) {
            reviewStatus = 'Approved';
          } else {
            reviewStatus = 'In review';
          }
        } else if (data.requested_reviewers && data.requested_reviewers.length > 0) {
          reviewStatus = 'In review';
        }
      }
    } catch (e) {
      console.error('Error fetching reviews:', e);
    }

    const prData = {
      url: data.html_url,
      number: data.number,
      title: data.title,
      owner,
      repo,
      state: data.state, // "open" or "closed"
      merged: data.merged, // true or false
      draft: data.draft, // true or false
      additions: data.additions,
      deletions: data.deletions,
      reviewStatus,
      createdAt: data.created_at,
      author: data.user?.login,
      authorAvatar: data.user?.avatar_url
    };

    return res.json(prData);
  } catch (error) {
    console.error('Error fetching GitHub PR:', error);
    return res.status(500).json({ error: 'Internal server error while fetching PR details' });
  }
});

module.exports = router;
