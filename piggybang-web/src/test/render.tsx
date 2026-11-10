import { render } from "@testing-library/react";
import { NextIntlClientProvider } from "next-intl";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import messages from "@/i18n/messages/id.json";

export function renderUI(ui: React.ReactElement) {
  const qc = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  return render(
    <QueryClientProvider client={qc}>
      <NextIntlClientProvider locale="id" messages={messages} timeZone="Asia/Jakarta">
        {ui}
      </NextIntlClientProvider>
    </QueryClientProvider>,
  );
}

export { messages };
