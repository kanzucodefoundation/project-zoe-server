import { Injectable } from '@nestjs/common';
import { IReconciliationPlugin } from '../interfaces/reconciliation-plugin.interface';

@Injectable()
export class ReconciliationPluginRegistry {
  private plugins: Map<string, IReconciliationPlugin> = new Map();
  private defaultPluginId: string | null = null;

  /**
   * Register a plugin with the registry
   */
  register(plugin: IReconciliationPlugin, isDefault: boolean = false): void {
    this.plugins.set(plugin.pluginId, plugin);

    if (isDefault || this.defaultPluginId === null) {
      this.defaultPluginId = plugin.pluginId;
    }
  }

  /**
   * Get a plugin by its ID
   */
  get(pluginId: string): IReconciliationPlugin | undefined {
    return this.plugins.get(pluginId);
  }

  /**
   * Get the default plugin
   */
  getDefault(): IReconciliationPlugin | undefined {
    if (this.defaultPluginId) {
      return this.plugins.get(this.defaultPluginId);
    }
    return undefined;
  }

  /**
   * Get all registered plugins
   */
  getAll(): IReconciliationPlugin[] {
    return Array.from(this.plugins.values());
  }

  /**
   * Check if a plugin exists
   */
  has(pluginId: string): boolean {
    return this.plugins.has(pluginId);
  }

  /**
   * Set the default plugin
   */
  setDefault(pluginId: string): void {
    if (!this.plugins.has(pluginId)) {
      throw new Error(`Plugin with ID '${pluginId}' not found`);
    }
    this.defaultPluginId = pluginId;
  }
}
