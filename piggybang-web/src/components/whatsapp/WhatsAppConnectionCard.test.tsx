import { describe, expect, it, vi } from "vitest";
import { screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { renderUI } from "@/test/render";
import type { WhatsAppConnection } from "@/types";
import { WhatsAppConnectedCard } from "./WhatsAppConnectedCard";

const conn: WhatsAppConnection = {
  mode: "all_in",
  phone_number: "+62 857-1121-9731",
  status: "connected",
  connected_at: "2026-08-01T00:00:00Z",
  monthly_conversations: 234,
  conversation_limit: 500,
  linked_senders: ["+6281234"],
};

describe("WhatsAppConnectedCard", () => {
  it("shows number and reply quota", () => {
    renderUI(<WhatsAppConnectedCard connection={conn} onTest={() => {}} onDisconnect={() => {}} />);
    expect(screen.getByText("WhatsApp Terhubung")).toBeInTheDocument();
    expect(screen.getByText("+62 857-1121-9731")).toBeInTheDocument();
    expect(screen.getByText("234 / 500")).toBeInTheDocument();
  });

  it("shows the paid-text cap and fires actions", async () => {
    const onTest = vi.fn();
    const onDisconnect = vi.fn();
    renderUI(<WhatsAppConnectedCard connection={{ ...conn, monthly_conversations: 12, conversation_limit: 60 }} onTest={onTest} onDisconnect={onDisconnect} />);
    expect(screen.getByText("12 / 60")).toBeInTheDocument();
    await userEvent.click(screen.getByRole("button", { name: "Uji Kirim Pesan" }));
    await userEvent.click(screen.getByRole("button", { name: "Putuskan Koneksi" }));
    expect(onTest).toHaveBeenCalledOnce();
    expect(onDisconnect).toHaveBeenCalledOnce();
  });
});
