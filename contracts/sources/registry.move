module vera_audit::registry {
    use std::string::String;
    use sui::event;
    use sui::object::{Self, UID};
    use sui::table::{Self, Table};
    use sui::transfer;
    use sui::tx_context::{Self, TxContext};
    use std::vector;

    const E_NOT_ADMIN: u64 = 0;
    const E_INVALID_SEVERITY: u64 = 1;
    const E_INVALID_TIMESTAMP: u64 = 2;

    public struct AuditRegistry has key {
        id: UID,
        admin: address,
        total_audits: u64,
        audits: Table<address, vector<AuditEntry>>,
    }

    public struct AuditEntry has store, copy, drop {
        walrus_blob_id: String,
        audit_hash: String,
        auditor: address,
        epoch: u64,
        severity: u8,
        timestamp_ms: u64,
    }

    public struct AuditSubmitted has copy, drop {
        contract_id: address,
        walrus_blob_id: String,
        audit_hash: String,
        severity: u8,
        auditor: address,
        epoch: u64,
        timestamp_ms: u64,
    }

    fun init(ctx: &mut TxContext) {
        let registry = AuditRegistry {
            id: object::new(ctx),
            admin: tx_context::sender(ctx),
            total_audits: 0,
            audits: table::new(ctx),
        };
        transfer::share_object(registry);
    }

    fun assert_admin(registry: &AuditRegistry, ctx: &TxContext) {
        assert!(tx_context::sender(ctx) == registry.admin, E_NOT_ADMIN);
    }

    #[allow(unused_mut_parameter)]
    entry fun submit_audit(
        registry: &mut AuditRegistry,
        contract_id: address,
        walrus_blob_id: String,
        audit_hash: String,
        severity: u8,
        timestamp_ms: u64,
        ctx: &mut TxContext
    ) {
        assert_admin(registry, ctx);
        assert!(severity <= 4, E_INVALID_SEVERITY);
        assert!(timestamp_ms > 0, E_INVALID_TIMESTAMP);

        let new_entry = AuditEntry {
            walrus_blob_id,
            audit_hash,
            auditor: tx_context::sender(ctx),
            epoch: tx_context::epoch(ctx),
            severity,
            timestamp_ms,
        };

        if (table::contains(&registry.audits, contract_id)) {
            let entries = table::borrow_mut(&mut registry.audits, contract_id);
            vector::push_back(entries, new_entry);
        } else {
            table::add(&mut registry.audits, contract_id, vector[new_entry]);
        };

        registry.total_audits = registry.total_audits + 1;

        event::emit(AuditSubmitted {
            contract_id,
            walrus_blob_id,
            audit_hash,
            severity,
            auditor: tx_context::sender(ctx),
            epoch: tx_context::epoch(ctx),
            timestamp_ms,
        });
    }

    public fun get_audits(registry: &AuditRegistry, contract_id: address): vector<AuditEntry> {
        if (table::contains(&registry.audits, contract_id)) {
            *table::borrow(&registry.audits, contract_id)
        } else {
            vector[]
        }
    }

    public fun total_audits(registry: &AuditRegistry): u64 {
        registry.total_audits
    }

    public fun admin(registry: &AuditRegistry): address {
        registry.admin
    }
}
