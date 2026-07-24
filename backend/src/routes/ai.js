const express = require('express');
const router = express.Router();
const path = require('path');
const fs = require('fs').promises;
const os = require('os');
const { exec } = require('child_process');
const util = require('util');
const { authenticateToken } = require('../middleware/auth');
const { PrismaClient } = require('@prisma/client');

const prisma = new PrismaClient();
const execPromise = util.promisify(exec);

const getFilesRecursive = async (dir, baseDir, ignoreList = [], fileList = []) => {
    const files = await fs.readdir(dir, { withFileTypes: true });
    for (const file of files) {
        if (['node_modules', '.git', 'dist', 'build', '.idea', 'public', 'assets', 'coverage'].includes(file.name)) continue;
        const filepath = path.join(dir, file.name);
        const relativePath = path.relative(baseDir, filepath).replace(/\\/g, '/');
        
        // Check .aiignore
        if (ignoreList.some(pattern => relativePath.includes(pattern))) continue;

        if (file.isDirectory()) {
            await getFilesRecursive(filepath, baseDir, ignoreList, fileList);
        } else {
            if (/\.(js|jsx|ts|tsx|prisma|txt|md|css|html|json)$/i.test(file.name) && !file.name.includes('package-lock') && !file.name.includes('yarn.lock')) {
                try {
                    const stats = await fs.stat(filepath);
                    // 50KB limit per file to avoid token limit issues generically
                    if (stats.size > 50000) {
                        fileList.push({
                            path: relativePath,
                            content: `// [Content excluded by Auto-Code because file size (${Math.round(stats.size/1024)}KB) exceeds 50KB limit]`
                        });
                    } else {
                        const content = await fs.readFile(filepath, 'utf8');
                        fileList.push({
                            path: relativePath,
                            content
                        });
                    }
                } catch (e) {
                    console.error(`Failed to read file ${filepath}`, e);
                }
            }
        }
    }
    return fileList;
};

router.post('/auto-code/:taskId', authenticateToken, async (req, res) => {
    const taskId = req.params.taskId;

    try {
        const task = await prisma.task.findUnique({
            where: { id: taskId },
            include: { section: { include: { project: true } } }
        });

        if (!task || !task.section || !task.section.project) {
            return res.status(404).json({ error: 'Task or project not found.' });
        }

        const project = task.section.project;
        let githubRepo = project.githubRepo;

        if (!githubRepo) {
            return res.status(400).json({ error: 'No GitHub repository connected to this project.' });
        }

        if (!process.env.GEMINI_API_KEY) {
            return res.status(500).json({ error: 'GEMINI_API_KEY is missing in server environment.' });
        }

        const githubToken = process.env.GITHUB_TOKEN;
        if (!githubToken) {
            return res.status(500).json({ error: 'GITHUB_TOKEN is missing in server environment.' });
        }

        // Clean up githubRepo URL if user pasted full URL
        let repoPath = githubRepo;
        if (githubRepo.includes('github.com')) {
            const urlObj = new URL(githubRepo.startsWith('http') ? githubRepo : `https://${githubRepo}`);
            repoPath = urlObj.pathname.slice(1);
            if (repoPath.endsWith('.git')) repoPath = repoPath.slice(0, -4);
        }

        const cloneUrl = `https://${githubToken}@github.com/${repoPath}.git`;
        const tempDir = path.join(os.tmpdir(), `asana-autocode-${taskId}-${Date.now()}`);

        console.log(`Cloning ${repoPath} into ${tempDir}...`);

        try {
            await execPromise(`git clone ${cloneUrl} ${tempDir}`);
        } catch (e) {
            console.error('Git clone failed:', e);
            return res.status(500).json({ error: 'Failed to clone repository. Check GITHUB_TOKEN and repo URL.' });
        }

        let ignoreList = [];
        try {
            const aiignoreContent = await fs.readFile(path.join(tempDir, '.aiignore'), 'utf8');
            const customIgnore = aiignoreContent.split('\n').map(l => l.trim()).filter(l => l && !l.startsWith('#'));
            ignoreList = [...ignoreList, ...customIgnore];
            console.log('Found .aiignore with rules:', customIgnore);
        } catch (err) {
            // No .aiignore found, that's fine
        }
        const sourceFiles = await getFilesRecursive(tempDir, tempDir, ignoreList);

        // Build prompt
        const prompt = `
You are an expert software engineer.
You are tasked with implementing the following issue in the codebase.

Task Title: ${task.title}
Task Description: ${task.description || 'No description provided.'}

Codebase context (relevant files):
${sourceFiles.map(f => `--- ${f.path} ---\n${f.content}\n`).join('\n')}

Instructions:
1. Understand the task and the provided codebase context.
2. If the task requires updating or continuing content from an existing file, you MUST use the EXACT same file path as shown in the codebase context above.
3. If you need to create a new file, specify an appropriate relative path.
4. For any modified file, you MUST provide the FULL, completely updated content of the file. Do not provide just snippets.

Return a valid JSON object strictly matching this format (no markdown, no extra text):
{
  "modifications": [
    {
      "path": "relative/path/to/file",
      "content": "the complete new content of the file"
    }
  ]
}
`;

        console.log('Calling Gemini API...');
        const modelName = process.env.GEMINI_MODEL || 'gemini-2.5-flash';
        const geminiUrl = `https://generativelanguage.googleapis.com/v1beta/models/${modelName}:generateContent?key=${process.env.GEMINI_API_KEY}`;

        let geminiRes;
        let retries = 3;
        while (retries > 0) {
            geminiRes = await fetch(geminiUrl, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    contents: [{ parts: [{ text: prompt }] }],
                    generationConfig: {
                        temperature: 0.2,
                        responseMimeType: "application/json"
                    }
                })
            });

            if (geminiRes.ok) break;

            if (geminiRes.status === 503) {
                console.warn(`Gemini API 503. Retrying... (${retries - 1} retries left)`);
                retries--;
                if (retries === 0) break;
                await new Promise(r => setTimeout(r, 3000)); // wait 3 seconds before retry
            } else if (geminiRes.status === 429) {
                throw new Error('Google Gemini API Kota Sınırı Aşıldı (Dakika başı token limiti). Lütfen yaklaşık 1 dakika bekleyip tekrar deneyin.');
            } else {
                break; // Don't retry on 4xx or other errors
            }
        }

        if (!geminiRes.ok && geminiRes.status !== 429) {
            const errBody = await geminiRes.text();
            console.error('Gemini API Error:', errBody);
            throw new Error(`Gemini API failed: ${geminiRes.statusText || 'Service Unavailable'}`);
        }

        const geminiData = await geminiRes.json();
        const responseText = geminiData.candidates[0].content.parts[0].text;

        let modifications = [];
        let cleanedText = responseText.trim();
        if (cleanedText.startsWith('```json')) {
            cleanedText = cleanedText.replace(/^```json\n?/, '').replace(/\n?```$/, '').trim();
        } else if (cleanedText.startsWith('```')) {
            cleanedText = cleanedText.replace(/^```\n?/, '').replace(/\n?```$/, '').trim();
        }

        try {
            // Find the first { and last } to extract just the JSON object
            const firstBrace = cleanedText.indexOf('{');
            const lastBrace = cleanedText.lastIndexOf('}');
            if (firstBrace !== -1 && lastBrace !== -1 && lastBrace >= firstBrace) {
                cleanedText = cleanedText.substring(firstBrace, lastBrace + 1);
            }

            const parsed = JSON.parse(cleanedText);
            modifications = parsed.modifications || [];
        } catch (e) {
            console.error('Failed to parse Gemini JSON:', responseText);
            throw new Error('LLM did not return valid JSON modifications.');
        }

        if (modifications.length === 0) {
            return res.status(400).json({ error: 'AI did not propose any changes for this task.' });
        }

        console.log(`Applying ${modifications.length} modifications...`);
        for (const mod of modifications) {
            const filePath = path.join(tempDir, mod.path);
            const dir = path.dirname(filePath);
            await fs.mkdir(dir, { recursive: true });
            await fs.writeFile(filePath, mod.content, 'utf8');
        }

        const branchName = `feature/task-${taskId.substring(0, 8)}`;
        console.log(`Committing and pushing to ${branchName}...`);

        // Git config
        await execPromise(`git config user.email "ai@asana-clone.local"`, { cwd: tempDir });
        await execPromise(`git config user.name "AI Auto-Coder"`, { cwd: tempDir });

        await execPromise(`git checkout -b ${branchName}`, { cwd: tempDir });
        await execPromise(`git add .`, { cwd: tempDir });
        await execPromise(`git commit -m "Auto-implemented task: ${task.title.replace(/"/g, '\\"')}"`, { cwd: tempDir });
        await execPromise(`git push -u origin ${branchName} --force`, { cwd: tempDir });

        // Clean up
        await fs.rm(tempDir, { recursive: true, force: true }).catch(e => console.error('Failed to clean temp dir', e));

        let prUrl = `https://github.com/${repoPath}/pull/new/${branchName}`;
        let prAddedToDb = null;
        try {
            console.log('Creating Pull Request...');
            const repoRes = await fetch(`https://api.github.com/repos/${repoPath}`, {
                headers: { 'Authorization': `token ${githubToken}`, 'Accept': 'application/vnd.github.v3+json', 'User-Agent': 'Asana-Clone-AI' }
            });
            if (repoRes.ok) {
                const repoData = await repoRes.json();
                const defaultBranch = repoData.default_branch || 'main';

                const prRes = await fetch(`https://api.github.com/repos/${repoPath}/pulls`, {
                    method: 'POST',
                    headers: {
                        'Authorization': `token ${githubToken}`,
                        'Accept': 'application/vnd.github.v3+json',
                        'Content-Type': 'application/json',
                        'User-Agent': 'Asana-Clone-AI'
                    },
                    body: JSON.stringify({
                        title: `Auto-implemented task: ${task.title}`,
                        body: `This PR was automatically generated by AI.\n\nTask: ${task.title}\nDescription: ${task.description || ''}`,
                        head: branchName,
                        base: defaultBranch
                    })
                });
                if (prRes.ok) {
                    const prData = await prRes.json();
                    prUrl = prData.html_url;
                    console.log('PR created successfully:', prUrl);

                    // Add PR to task in database
                    try {
                        prAddedToDb = {
                            url: prData.html_url,
                            number: prData.number,
                            title: prData.title,
                            owner: repoPath.split('/')[0],
                            repo: repoPath.split('/')[1],
                            state: prData.state,
                            merged: prData.merged,
                            draft: prData.draft,
                            additions: prData.additions,
                            deletions: prData.deletions,
                            reviewStatus: 'No reviews',
                            createdAt: prData.created_at,
                            author: prData.user?.login,
                            authorAvatar: prData.user?.avatar_url
                        };

                        let existingPRs = typeof task.githubPRs === 'string'
                            ? JSON.parse(task.githubPRs || '[]')
                            : (task.githubPRs || []);

                        existingPRs.push(prAddedToDb);

                        await prisma.task.update({
                            where: { id: taskId },
                            data: { githubPRs: JSON.stringify(existingPRs) }
                        });
                        console.log('Task successfully updated with new PR.');
                        
                        // Trigger Rule Engine for custom fields of type 'github_pr'
                        if (task.section && task.section.projectId) {
                            const projectId = task.section.projectId;
                            const proj = await prisma.project.findUnique({ where: { id: projectId } });
                            if (proj && proj.customFieldSettings) {
                                const cfs = typeof proj.customFieldSettings === 'string' ? JSON.parse(proj.customFieldSettings) : proj.customFieldSettings;
                                const prFields = (Array.isArray(cfs) ? cfs : []).filter(f => f.type === 'github_pr');
                                for (const prField of prFields) {
                                    await evaluateRules(projectId, taskId, { type: 'custom_field_changed', fieldName: prField.id });
                                }
                            }
                        }
                    } catch (dbErr) {
                        console.error('Failed to attach PR to task in database:', dbErr);
                    }
                } else {
                    console.error('Failed to create PR:', await prRes.text());
                }
            }
        } catch (prErr) {
            console.error('Error creating PR:', prErr);
        }

        res.json({
            message: 'Task successfully coded and pushed.',
            branch: branchName,
            prUrl,
            newPrData: prAddedToDb
        });

    } catch (error) {
        console.error('Auto-code error:', error);
        res.status(500).json({ error: error.message || 'An error occurred during auto-coding.' });
    }
});

module.exports = router;
