import { prisma } from "../prisma";
import { Config } from "@prisma/client";

export class ConfigModel {
  private _data!: Config; // will be assigned after successful retrieval

  async retrieve(id: string): Promise<Config> {
    const config = await prisma.config.findUnique({
      where: { id },
    });

    if (!config) {
      throw new Error(`Config with id ${id} not found`);
    }

    this._data = config;
    return config;
  }

  /**
   * Returns the previously‑retrieved Config. Call `retrieve` first.
   */
  get data(): Config {
    return this._data;
  }
}
