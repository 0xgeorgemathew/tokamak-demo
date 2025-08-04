import { KNOWN_PROTOCOLS } from "../constants";
import { ProtocolInteraction } from "../types";

export function detectProtocols(trace: any): ProtocolInteraction[] {
    const protocols: ProtocolInteraction[] = [];
    const addresses = new Set<string>();

    // Collect all interacted addresses
    addresses.add(trace.to?.toLowerCase());
    const collectAddresses = (call: any) => {
        if (call.to) addresses.add(call.to.toLowerCase());
        call.calls?.forEach(collectAddresses);
    };
    if (trace.calls) collectAddresses(trace);

    // Match against known protocols
    for (const address of addresses) {
        if (address && KNOWN_PROTOCOLS[ address as keyof typeof KNOWN_PROTOCOLS ]) {
            protocols.push({
                address,
                protocol: KNOWN_PROTOCOLS[ address as keyof typeof KNOWN_PROTOCOLS ],
                confidence: 'high',
            });
        }
    }

    return protocols;
}
