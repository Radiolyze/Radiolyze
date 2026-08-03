import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";
import { render, screen, waitFor, fireEvent, act } from "@testing-library/react";
import { DicomWebSettings } from "../DicomWebSettings";
import i18n from "@/i18n";

/**
 * jsdom has no `fetch`, and the component only ever reads `ok`, `status` and the
 * `content-type` header off the response — so a hand-rolled stub is enough and
 * keeps the connection-test branches easy to drive.
 */
function stubResponse(status: number, contentType: string | null): Response {
  return {
    ok: status >= 200 && status < 300,
    status,
    headers: {
      get: (name: string) => (name.toLowerCase() === "content-type" ? contentType : null),
    },
  } as unknown as Response;
}

const fetchMock = vi.fn<typeof fetch>();

async function setLanguage(lng: string) {
  await act(async () => {
    await i18n.changeLanguage(lng);
  });
}

async function testConnection() {
  // The click kicks off an async fetch whose resolution sets state, so the whole
  // round trip has to settle inside act() rather than just the click itself.
  await act(async () => {
    fireEvent.click(
      screen.getByRole("button", { name: i18n.t("settings:dicomweb.testConnection") }),
    );
  });
}

beforeEach(async () => {
  localStorage.clear();
  fetchMock.mockReset();
  vi.stubGlobal("fetch", fetchMock);
  await setLanguage("en");
});

afterEach(() => {
  vi.unstubAllGlobals();
});

describe("DicomWebSettings", () => {
  it("renders the panel in the active language", async () => {
    render(<DicomWebSettings />);

    expect(screen.getByText("DICOMweb server")).toBeInTheDocument();
    expect(screen.getByLabelText("Server URL")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Test connection" })).toBeInTheDocument();

    await setLanguage("de");

    expect(screen.getByText("DICOMweb-Server")).toBeInTheDocument();
    expect(screen.getByLabelText("Server-URL")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Verbindung testen" })).toBeInTheDocument();
  });

  it("keeps the url hint's inline path markup", () => {
    render(<DicomWebSettings />);

    // Rendered through <Trans> with components={{ path: <span className="font-mono" /> }} —
    // a translation that loses the tag would drop the path out of the sentence.
    expect(screen.getByText("/dicom-web", { selector: "span.font-mono" })).toBeInTheDocument();
  });

  it("reports a rejected login through the auth-failure message", async () => {
    fetchMock.mockResolvedValue(stubResponse(401, "text/html"));
    render(<DicomWebSettings />);

    await testConnection();

    await waitFor(() => expect(screen.getByText("Authentication failed")).toBeInTheDocument());
    expect(screen.getByText("The username or password is invalid.")).toBeInTheDocument();
  });

  it("names the content type when the server answers with something other than DICOMweb", async () => {
    fetchMock.mockResolvedValue(stubResponse(200, "text/html; charset=utf-8"));
    render(<DicomWebSettings />);

    await testConnection();

    await waitFor(() => expect(screen.getByText("Invalid response")).toBeInTheDocument());
    expect(screen.getByText(/returns HTML instead of DICOMweb/)).toBeInTheDocument();
    expect(screen.getByText(/text\/html; charset=utf-8/)).toBeInTheDocument();
  });

  it("re-renders a result already on screen when the language changes", async () => {
    fetchMock.mockResolvedValue(stubResponse(503, "application/json"));
    render(<DicomWebSettings />);

    await testConnection();
    await waitFor(() => expect(screen.getByText("HTTP 503")).toBeInTheDocument());
    expect(screen.getByText("The server responded with status 503.")).toBeInTheDocument();

    // The outcome is held as a key plus its values rather than a resolved string,
    // so switching language reformats the alert instead of leaving it in English.
    await setLanguage("de");

    expect(screen.getByText("Der Server hat mit Status 503 geantwortet.")).toBeInTheDocument();
  });

  it("passes a server-supplied error message through untranslated", async () => {
    fetchMock.mockRejectedValue(new Error("certificate has expired"));
    render(<DicomWebSettings />);

    await testConnection();

    await waitFor(() => expect(screen.getByText("Connection error")).toBeInTheDocument());
    expect(screen.getByText("certificate has expired")).toBeInTheDocument();
  });

  it("labels the password reveal toggle for screen readers", async () => {
    render(<DicomWebSettings />);

    const toggle = screen.getByRole("button", { name: "Show password" });
    fireEvent.click(toggle);

    expect(screen.getByRole("button", { name: "Hide password" })).toBeInTheDocument();
  });
});
