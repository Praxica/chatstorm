import { Config } from '@/lib/stores/configsStore';

interface Template {
  id: string;
  title: string;
  configId: string;
  previewChatId: string;
  description?: string;
  category?: string;
  isPublic?: boolean;
  createdAt: string;
  updatedAt: string;
}

export class TemplateService {
  static async getTemplate(templateId: string): Promise<Template> {
    const response = await fetch(`/api/templates/${templateId}`);
    if (!response.ok) {
      throw new Error(`Failed to fetch template: ${response.status} ${await response.text()}`);
    }
    return response.json();
  }

  static async getTemplateConfig(templateId: string): Promise<Config> {
    const response = await fetch(`/api/preview/${templateId}/config`);
    if (!response.ok) {
      throw new Error('Failed to fetch template config');
    }
    return response.json();
  }

  static async installTemplate(templateId: string): Promise<{ chatId: string; configId: string }> {
    const response = await fetch(`/api/templates/${templateId}/install`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
    });
    if (!response.ok) {
      throw new Error('Failed to install template');
    }
    return response.json();
  }
} 