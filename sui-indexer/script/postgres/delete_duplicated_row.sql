WITH add_row_num AS (
    SELECT
        *,
        row_number() OVER (
			PARTITION BY tx_hash, log_index
			ORDER BY log_index
		) as rn
    FROM trade_sui
    ORDER BY tx_hash
),
     duplicated_row AS (
         SELECT * FROM add_row_num
         WHERE rn > 1
     )
DELETE FROM trade_sui WHERE id IN (
    SELECT id FROM duplicated_row
);