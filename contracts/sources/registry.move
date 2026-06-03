module vera_audit::registry {
    use std::string::String;
    use sui::clock::{Self, Clock};
    use sui::event;
    use sui::object::{Self, UID};
    use sui::table::{Self, Table};
    use sui::transfer;
    use sui::tx_context::{Self, TxContext};
    use std::vector; 

    // --- Error Constants ---
    const EInvalidSeverity: u64 = 1;

    // --- Capabilities ---
    
    /// Capability granting permission to submit audits.
    /// `store` ability so the capability can be transferred, 
    /// sold, or placed into a multisig/DAO in the future.
    public struct AdminCap has key, store {
        id: UID
    }

    // --- Structs ---

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

    // --- Initialization ---

    fun init(ctx: &mut TxContext) {
        let registry = AuditRegistry {
            id: object::new(ctx),
            admin: tx_context::sender(ctx),
            total_audits: 0,
            audits: table::new(ctx),
        };

        // Mint the AdminCap and send it directly to the deployer.
        transfer::transfer(
            AdminCap { id: object::new(ctx) }, 
            tx_context::sender(ctx)
        );

        // Share the registry so anyone can read from it.
        transfer::share_object(registry);
    }

    // --- Public / Entry Functions ---

    public fun submit_audit(
        _: &AdminCap, 
        registry: &mut AuditRegistry,
        clock: &Clock, 
        contract_id: address,
        walrus_blob_id: String,
        audit_hash: String,
        severity: u8,
        ctx: &mut TxContext
    ) {
        assert!(severity <= 4, EInvalidSeverity);

        let timestamp_ms = clock::timestamp_ms(clock);

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
            // Using the new vector literal syntax
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

    // --- View Functions ---

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