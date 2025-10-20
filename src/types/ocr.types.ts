export interface DimensionData<T = void> {
  left: number;
  top: number;
  width: number;
  height: number;
  baseline?: number;
  data?: T;
}

export interface DataContent {
  id: string;
  content: string;
  type: 'QR_CODE' | 'BAR_CODE' | 'OTHER' | string;
}

export interface TextContent {
  id: string;
  text: string;
  confidence?: number;
}
