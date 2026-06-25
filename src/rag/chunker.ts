import * as fs from 'node:fs';
import * as path from 'node:path';

export interface DocChunk {
  id: string;
  text: string;
  metadata: {
    source: string;
    section: string;
    category: 'code-smell' | 'design-pattern' | 'modernization';
  };
}

export function chunkKnowledgeDocs(knowledgeDir: string): DocChunk[] {
  const chunks: DocChunk[] = [];

  const files: Array<{ name: string; category: DocChunk['metadata']['category'] }> = [
    { name: '01-code-smells-rulebook.md', category: 'code-smell' },
    { name: '02-design-patterns-rulebook.md', category: 'design-pattern' },
    { name: '03-modernization-rulebook.md', category: 'modernization' },
  ];

  for (const { name, category } of files) {
    const filePath = path.join(knowledgeDir, name);
    if (!fs.existsSync(filePath)) continue;

    const content = fs.readFileSync(filePath, 'utf-8');
    const sections = splitByH2(content);

    for (const section of sections) {
      if (section.text.length < 50) continue;

      chunks.push({
        id: `${name}::${section.heading}`,
        text: section.text,
        metadata: {
          source: name,
          section: section.heading,
          category,
        },
      });
    }
  }

  return chunks;
}

interface Section {
  heading: string;
  text: string;
}

function splitByH2(content: string): Section[] {
  const lines = content.split('\n');
  const sections: Section[] = [];
  let currentHeading = '';
  let currentLines: string[] = [];

  for (const line of lines) {
    if (line.startsWith('## ')) {
      if (currentHeading && currentLines.length > 0) {
        sections.push({ heading: currentHeading, text: currentLines.join('\n') });
      }
      currentHeading = line.replace('## ', '').trim();
      currentLines = [line];
    } else {
      currentLines.push(line);
    }
  }

  if (currentHeading && currentLines.length > 0) {
    sections.push({ heading: currentHeading, text: currentLines.join('\n') });
  }

  return sections;
}
