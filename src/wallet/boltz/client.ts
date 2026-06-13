// Boltz API v2 REST client. Thin wrapper around the core HTTP client;
// never logs secrets, never retries mutations blindly.
import { httpRequest } from '@/core/net';
import type {
  BoltzStatus,
  ClaimSignatureRequest,
  ClaimSignatureResponse,
  RefundSignatureRequest,
  CreateReverseSwapRequest,
  CreateReverseSwapResponse,
  CreateSubmarineSwapRequest,
  CreateSubmarineSwapResponse,
  PartialSignature,
  ReversePair,
  SubmarinePair,
  SwapAsset,
  SwapStatusResponse,
} from './types';

export class BoltzClient {
  constructor(private readonly baseUrl: string) {}

  private url(path: string): string {
    return `${this.baseUrl.replace(/\/+$/, '')}${path}`;
  }

  async getVersion(): Promise<string> {
    const res = await httpRequest<{ version: string }>({
      baseUrl: this.baseUrl,
      path: '/version',
      idempotent: true,
    });
    return res.data.version;
  }

  async getReversePairs(): Promise<Record<SwapAsset, Record<SwapAsset, ReversePair>>> {
    const res = await httpRequest<Record<string, Record<string, ReversePair>>>({
      baseUrl: this.baseUrl,
      path: '/swap/reverse',
      idempotent: true,
    });
    return res.data as Record<SwapAsset, Record<SwapAsset, ReversePair>>;
  }

  async getSubmarinePairs(): Promise<Record<SwapAsset, Record<SwapAsset, SubmarinePair>>> {
    const res = await httpRequest<Record<string, Record<string, SubmarinePair>>>({
      baseUrl: this.baseUrl,
      path: '/swap/submarine',
      idempotent: true,
    });
    return res.data as Record<SwapAsset, Record<SwapAsset, SubmarinePair>>;
  }

  async createReverseSwap(req: CreateReverseSwapRequest): Promise<CreateReverseSwapResponse> {
    const res = await httpRequest<CreateReverseSwapResponse>({
      baseUrl: this.baseUrl,
      path: '/swap/reverse',
      method: 'POST',
      body: req,
      idempotent: false,
    });
    return res.data;
  }

  async createSubmarineSwap(req: CreateSubmarineSwapRequest): Promise<CreateSubmarineSwapResponse> {
    const res = await httpRequest<CreateSubmarineSwapResponse>({
      baseUrl: this.baseUrl,
      path: '/swap/submarine',
      method: 'POST',
      body: req,
      idempotent: false,
    });
    return res.data;
  }

  async getSwapStatus(id: string): Promise<SwapStatusResponse> {
    const res = await httpRequest<{ status: BoltzStatus; zeroConfRejected?: boolean; transaction?: unknown }>({
      baseUrl: this.baseUrl,
      path: `/swap/status/${id}`,
      idempotent: true,
    });
    return res.data as SwapStatusResponse;
  }

  async getSubmarineClaimDetails(id: string): Promise<{
    preimage: string;
    pubNonce: string;
    publicKey: string;
    transactionHash: string;
  }> {
    const res = await httpRequest<{
      preimage: string;
      pubNonce: string;
      publicKey: string;
      transactionHash: string;
    }>({
      baseUrl: this.baseUrl,
      path: `/swap/submarine/${id}/claim`,
      idempotent: true,
    });
    return res.data;
  }

  async postSubmarineClaimSignature(id: string, sig: PartialSignature): Promise<void> {
    await httpRequest<unknown>({
      baseUrl: this.baseUrl,
      path: `/swap/submarine/${id}/claim`,
      method: 'POST',
      body: sig,
      idempotent: false,
    });
  }

  async getSubmarineRefundSignature(id: string, req: RefundSignatureRequest): Promise<ClaimSignatureResponse> {
    const res = await httpRequest<ClaimSignatureResponse>({
      baseUrl: this.baseUrl,
      path: `/swap/submarine/${id}/refund`,
      method: 'POST',
      body: req,
      idempotent: false,
    });
    return res.data;
  }

  async getReverseClaimSignature(
    id: string,
    req: ClaimSignatureRequest,
  ): Promise<ClaimSignatureResponse> {
    const res = await httpRequest<ClaimSignatureResponse>({
      baseUrl: this.baseUrl,
      path: `/swap/reverse/${id}/claim`,
      method: 'POST',
      body: req,
      idempotent: false,
    });
    return res.data;
  }

  async broadcastTransaction(asset: SwapAsset, hex: string): Promise<{ id: string }> {
    const res = await httpRequest<{ id: string }>({
      baseUrl: this.baseUrl,
      path: `/chain/${asset}/transaction`,
      method: 'POST',
      body: { hex },
      idempotent: false,
    });
    return res.data;
  }
}
