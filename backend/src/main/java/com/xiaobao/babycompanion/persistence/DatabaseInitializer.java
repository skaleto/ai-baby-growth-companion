package com.xiaobao.babycompanion.persistence;

import java.sql.Connection;
import java.sql.PreparedStatement;
import java.sql.ResultSet;
import java.sql.Statement;

import javax.sql.DataSource;

import com.fasterxml.jackson.databind.JsonNode;
import com.fasterxml.jackson.databind.ObjectMapper;
import com.fasterxml.jackson.databind.node.ArrayNode;
import com.fasterxml.jackson.databind.node.ObjectNode;
import org.springframework.boot.ApplicationArguments;
import org.springframework.boot.ApplicationRunner;
import org.springframework.stereotype.Component;

@Component
public class DatabaseInitializer implements ApplicationRunner {

    public static final String DEFAULT_FAMILY_ID = "family-default";
    public static final String DEFAULT_FAMILY_NAME = "小宝家";

    private final DataSource dataSource;
    private final ObjectMapper objectMapper;

    public DatabaseInitializer(DataSource dataSource, ObjectMapper objectMapper) {
        this.dataSource = dataSource;
        this.objectMapper = objectMapper;
    }

    @Override
    public void run(ApplicationArguments args) throws Exception {
        try (Connection connection = dataSource.getConnection(); Statement statement = connection.createStatement()) {
            statement.execute("PRAGMA journal_mode=WAL");
            statement.execute("PRAGMA synchronous=NORMAL");
            statement.execute("PRAGMA busy_timeout=10000");
            statement.execute("PRAGMA foreign_keys=ON");
            createRecordTable(connection, statement, "baby_profile");
            createRecordTable(connection, statement, "chat_message");
            createRecordTable(connection, statement, "growth_event");
            createRecordTable(connection, statement, "growth_measurement");
            createRecordTable(connection, statement, "care_log");
            createRecordTable(connection, statement, "reminder");
            createRecordTable(connection, statement, "memory_item");
            createRecordTable(connection, statement, "pending_effect");
            createRecordTable(connection, statement, "album_item");
            createRecordTable(connection, statement, "expense_item");
            createRecordTable(connection, statement, "conversation_summary");
            createAuthTables(connection, statement);
            createProTrialTables(statement);
            createAgentTraceTables(statement);
            createDataRightsTables(statement);
            createClientErrorTables(statement);
            statement.execute("""
                    CREATE TABLE IF NOT EXISTS attachment (
                      id TEXT PRIMARY KEY,
                      name TEXT,
                      kind TEXT,
                      mime_type TEXT,
                      file_path TEXT NOT NULL,
                      public_url TEXT,
                      thumbnail_path TEXT,
                      thumbnail_url TEXT,
                      owner_type TEXT,
                      owner_id TEXT,
                      owner_user_id TEXT,
                      family_id TEXT,
                      created_by_user_id TEXT,
                      created_at TEXT,
                      payload_json TEXT
                    )
                    """);
            addColumnIfMissing(connection, statement, "attachment", "owner_user_id", "TEXT");
            addColumnIfMissing(connection, statement, "attachment", "family_id", "TEXT");
            addColumnIfMissing(connection, statement, "attachment", "created_by_user_id", "TEXT");
            addColumnIfMissing(connection, statement, "attachment", "thumbnail_path", "TEXT");
            addColumnIfMissing(connection, statement, "attachment", "thumbnail_url", "TEXT");
            statement.execute("CREATE INDEX IF NOT EXISTS idx_attachment_owner ON attachment(owner_type, owner_id)");
            statement.execute("CREATE INDEX IF NOT EXISTS idx_attachment_owner_user ON attachment(owner_user_id)");
            statement.execute("CREATE INDEX IF NOT EXISTS idx_attachment_family ON attachment(family_id)");
            migrateDefaultFamily(statement);
            migrateExpenseBarcodeData(connection);
        }
    }

    private void createProTrialTables(Statement statement) throws Exception {
        statement.execute("""
                CREATE TABLE IF NOT EXISTS pro_trial_application (
                  id TEXT PRIMARY KEY,
                  family_id TEXT NOT NULL,
                  user_id TEXT NOT NULL,
                  phone TEXT,
                  source TEXT,
                  status TEXT,
                  created_at TEXT,
                  updated_at TEXT
                )
                """);
        statement.execute("CREATE INDEX IF NOT EXISTS idx_pro_trial_application_family ON pro_trial_application(family_id)");
        statement.execute("CREATE INDEX IF NOT EXISTS idx_pro_trial_application_user ON pro_trial_application(user_id)");
        statement.execute("""
                CREATE UNIQUE INDEX IF NOT EXISTS idx_pro_trial_application_family_user_active
                ON pro_trial_application(family_id, user_id)
                WHERE status IN ('pending', 'approved')
                """);

        statement.execute("""
                CREATE TABLE IF NOT EXISTS pro_trial_entitlement (
                  id TEXT PRIMARY KEY,
                  family_id TEXT NOT NULL UNIQUE,
                  enabled TEXT,
                  starts_at TEXT,
                  expires_at TEXT,
                  plan_code TEXT,
                  note TEXT,
                  created_at TEXT,
                  updated_at TEXT
                )
                """);
        statement.execute("CREATE INDEX IF NOT EXISTS idx_pro_trial_entitlement_family ON pro_trial_entitlement(family_id)");

        statement.execute("""
                CREATE TABLE IF NOT EXISTS redeem_code (
                  id TEXT PRIMARY KEY,
                  code TEXT NOT NULL UNIQUE,
                  plan_code TEXT,
                  expires_at TEXT,
                  max_uses INTEGER,
                  used_count INTEGER,
                  note TEXT,
                  created_at TEXT,
                  updated_at TEXT
                )
                """);

        statement.execute("""
                CREATE TABLE IF NOT EXISTS ai_usage_log (
                  id TEXT PRIMARY KEY,
                  family_id TEXT,
                  user_id TEXT,
                  request_id TEXT,
                  provider TEXT,
                  model TEXT,
                  feature TEXT,
                  input_type TEXT,
                  input_tokens INTEGER,
                  output_tokens INTEGER,
                  total_tokens INTEGER,
                  success TEXT,
                  error_code TEXT,
                  pro_required TEXT,
                  quota_counted TEXT,
                  created_at TEXT
                )
                """);
        statement.execute("CREATE INDEX IF NOT EXISTS idx_ai_usage_family_created ON ai_usage_log(family_id, created_at)");
        statement.execute("CREATE INDEX IF NOT EXISTS idx_ai_usage_request ON ai_usage_log(request_id)");
        // 「今日小结」已下线：daily_summary / daily_summary_setting 表不再创建；线上历史表保留不动（不 DROP）。
    }

    private void createAgentTraceTables(Statement statement) throws Exception {
        statement.execute("""
                CREATE TABLE IF NOT EXISTS agent_run (
                  id TEXT PRIMARY KEY,
                  trace_id TEXT NOT NULL,
                  family_id TEXT,
                  user_id TEXT,
                  message_id TEXT,
                  status TEXT,
                  input_type TEXT,
                  planner_model TEXT,
                  final_model TEXT,
                  planner_result_json TEXT,
                  skill_plan_json TEXT,
                  effect_summary_json TEXT,
                  error_code TEXT,
                  started_at TEXT,
                  completed_at TEXT,
                  created_at TEXT
                )
                """);
        statement.execute("CREATE INDEX IF NOT EXISTS idx_agent_run_trace ON agent_run(trace_id)");
        statement.execute("CREATE INDEX IF NOT EXISTS idx_agent_run_family_created ON agent_run(family_id, created_at)");
        statement.execute("CREATE INDEX IF NOT EXISTS idx_agent_run_status ON agent_run(status)");

        statement.execute("""
                CREATE TABLE IF NOT EXISTS skill_run (
                  id TEXT PRIMARY KEY,
                  trace_id TEXT NOT NULL,
                  agent_run_id TEXT,
                  skill_id TEXT NOT NULL,
                  mode TEXT,
                  status TEXT,
                  model_profile TEXT,
                  model TEXT,
                  batch_count INTEGER,
                  attachment_ids_json TEXT,
                  input_summary_json TEXT,
                  result_summary_json TEXT,
                  effect_candidate_summary_json TEXT,
                  user_facing_error TEXT,
                  error_code TEXT,
                  latency_ms INTEGER,
                  started_at TEXT,
                  completed_at TEXT,
                  created_at TEXT
                )
                """);
        statement.execute("CREATE INDEX IF NOT EXISTS idx_skill_run_trace ON skill_run(trace_id)");
        statement.execute("CREATE INDEX IF NOT EXISTS idx_skill_run_agent ON skill_run(agent_run_id)");
        statement.execute("CREATE INDEX IF NOT EXISTS idx_skill_run_skill_status ON skill_run(skill_id, status)");
    }

    private void createDataRightsTables(Statement statement) throws Exception {
        statement.execute("""
                CREATE TABLE IF NOT EXISTS data_rights_request (
                  id TEXT PRIMARY KEY,
                  trace_id TEXT,
                  family_id TEXT,
                  user_id TEXT,
                  type TEXT NOT NULL,
                  status TEXT,
                  reason TEXT,
                  created_at TEXT,
                  resolved_at TEXT,
                  resolution_note TEXT
                )
                """);
        statement.execute("CREATE INDEX IF NOT EXISTS idx_data_rights_request_user ON data_rights_request(user_id)");
        statement.execute("CREATE INDEX IF NOT EXISTS idx_data_rights_request_family ON data_rights_request(family_id)");
        statement.execute("CREATE INDEX IF NOT EXISTS idx_data_rights_request_status ON data_rights_request(status)");
    }

    private void createClientErrorTables(Statement statement) throws Exception {
        statement.execute("""
                CREATE TABLE IF NOT EXISTS client_error (
                  id TEXT PRIMARY KEY,
                  family_id TEXT,
                  user_id TEXT,
                  kind TEXT,
                  message TEXT,
                  page TEXT,
                  app_version TEXT,
                  bundle_version TEXT,
                  device_info TEXT,
                  created_at TEXT
                )
                """);
        statement.execute("CREATE INDEX IF NOT EXISTS idx_client_error_family_created ON client_error(family_id, created_at)");
        statement.execute("CREATE INDEX IF NOT EXISTS idx_client_error_kind_created ON client_error(kind, created_at)");
    }

    private void createRecordTable(Connection connection, Statement statement, String tableName) throws Exception {
        statement.execute("""
                CREATE TABLE IF NOT EXISTS %s (
                  id TEXT PRIMARY KEY,
                  payload_json TEXT NOT NULL,
                  role TEXT,
                  status TEXT,
                  sort_key TEXT,
                  owner_user_id TEXT,
                  family_id TEXT,
                  created_by_user_id TEXT,
                  created_at TEXT,
                  updated_at TEXT
                )
                """.formatted(tableName));
        addColumnIfMissing(connection, statement, tableName, "owner_user_id", "TEXT");
        addColumnIfMissing(connection, statement, tableName, "family_id", "TEXT");
        addColumnIfMissing(connection, statement, tableName, "created_by_user_id", "TEXT");
        statement.execute("CREATE INDEX IF NOT EXISTS idx_%s_sort ON %s(sort_key)".formatted(tableName, tableName));
        statement.execute("CREATE INDEX IF NOT EXISTS idx_%s_status ON %s(status)".formatted(tableName, tableName));
        statement.execute("CREATE INDEX IF NOT EXISTS idx_%s_owner_user ON %s(owner_user_id)".formatted(tableName, tableName));
        statement.execute("CREATE INDEX IF NOT EXISTS idx_%s_family ON %s(family_id)".formatted(tableName, tableName));
    }

    private void createAuthTables(Connection connection, Statement statement) throws Exception {
        statement.execute("""
                CREATE TABLE IF NOT EXISTS auth_user (
                  id TEXT PRIMARY KEY,
                  phone TEXT NOT NULL UNIQUE,
                  invite_code_hash TEXT,
                  created_at TEXT,
                  last_login_at TEXT
                )
                """);
        statement.execute("CREATE INDEX IF NOT EXISTS idx_auth_user_phone ON auth_user(phone)");
        statement.execute("""
                CREATE TABLE IF NOT EXISTS auth_family (
                  id TEXT PRIMARY KEY,
                  name TEXT,
                  default_invite_code_id TEXT,
                  created_at TEXT
                )
                """);
        statement.execute("""
                CREATE TABLE IF NOT EXISTS auth_family_member (
                  id TEXT PRIMARY KEY,
                  family_id TEXT NOT NULL,
                  user_id TEXT NOT NULL,
                  role_name TEXT,
                  is_caregiver TEXT,
                  joined_invite_code_id TEXT,
                  joined_at TEXT,
                  last_seen_at TEXT
                )
                """);
        statement.execute("CREATE UNIQUE INDEX IF NOT EXISTS idx_auth_family_member_user ON auth_family_member(user_id)");
        statement.execute("CREATE INDEX IF NOT EXISTS idx_auth_family_member_family ON auth_family_member(family_id)");
        statement.execute("""
                CREATE TABLE IF NOT EXISTS auth_invite_code (
                  id TEXT PRIMARY KEY,
                  code_hash TEXT NOT NULL UNIQUE,
                  label TEXT,
                  family_id TEXT,
                  assigned_user_id TEXT,
                  active TEXT,
                  created_at TEXT,
                  used_at TEXT
                )
                """);
        addColumnIfMissing(connection, statement, "auth_invite_code", "family_id", "TEXT");
        statement.execute("CREATE INDEX IF NOT EXISTS idx_auth_invite_code_hash ON auth_invite_code(code_hash)");
        statement.execute("CREATE INDEX IF NOT EXISTS idx_auth_invite_code_family ON auth_invite_code(family_id)");
        statement.execute("""
                CREATE TABLE IF NOT EXISTS auth_session (
                  id TEXT PRIMARY KEY,
                  user_id TEXT NOT NULL,
                  created_at TEXT,
                  expires_at TEXT,
                  revoked_at TEXT
                )
                """);
        statement.execute("CREATE INDEX IF NOT EXISTS idx_auth_session_user ON auth_session(user_id)");
    }

    private void migrateDefaultFamily(Statement statement) throws Exception {
        boolean needsDefaultFamily =
                hasRows(statement, """
                        SELECT 1 FROM auth_invite_code
                        WHERE (family_id IS NULL OR family_id = '')
                          AND (
                            (assigned_user_id IS NOT NULL AND assigned_user_id != '')
                            OR (used_at IS NOT NULL AND used_at != '')
                          )
                        LIMIT 1
                        """)
                        || hasRows(statement, """
                        SELECT 1 FROM auth_user u
                        WHERE NOT EXISTS (
                          SELECT 1 FROM auth_family_member m WHERE m.user_id = u.id
                        )
                        LIMIT 1
                        """);
        for (String table : recordTables()) {
            needsDefaultFamily = needsDefaultFamily || hasRows(statement, """
                    SELECT 1 FROM %s
                    WHERE family_id IS NULL OR family_id = ''
                    LIMIT 1
                    """.formatted(table));
        }
        needsDefaultFamily = needsDefaultFamily || hasRows(statement, """
                SELECT 1 FROM attachment
                WHERE family_id IS NULL OR family_id = ''
                LIMIT 1
                """);

        if (needsDefaultFamily) {
            statement.execute("""
                    INSERT OR IGNORE INTO auth_family (id, name, created_at)
                    VALUES ('%s', '%s', datetime('now'))
                    """.formatted(DEFAULT_FAMILY_ID, DEFAULT_FAMILY_NAME));
            statement.execute("""
                    UPDATE auth_invite_code
                    SET family_id = '%s'
                    WHERE (family_id IS NULL OR family_id = '')
                      AND (
                        (assigned_user_id IS NOT NULL AND assigned_user_id != '')
                        OR (used_at IS NOT NULL AND used_at != '')
                      )
                    """.formatted(DEFAULT_FAMILY_ID));
            statement.execute("""
                    UPDATE auth_family
                    SET default_invite_code_id = (
                      SELECT id FROM auth_invite_code
                      WHERE family_id = '%s'
                      ORDER BY created_at, id
                      LIMIT 1
                    )
                    WHERE id = '%s'
                      AND (default_invite_code_id IS NULL OR default_invite_code_id = '')
                    """.formatted(DEFAULT_FAMILY_ID, DEFAULT_FAMILY_ID));
            statement.execute("""
                    INSERT OR IGNORE INTO auth_family_member (
                      id, family_id, user_id, role_name, is_caregiver,
                      joined_invite_code_id, joined_at, last_seen_at
                    )
                    SELECT
                      'member-' || u.id,
                      '%s',
                      u.id,
                      '家庭照护人',
                      'true',
                      (
                        SELECT i.id FROM auth_invite_code i
                        WHERE i.code_hash = u.invite_code_hash
                        LIMIT 1
                      ),
                      COALESCE(u.created_at, datetime('now')),
                      u.last_login_at
                    FROM auth_user u
                    WHERE NOT EXISTS (
                      SELECT 1 FROM auth_family_member m WHERE m.user_id = u.id
                    )
                    """.formatted(DEFAULT_FAMILY_ID));
            for (String table : recordTables()) {
                statement.execute("""
                        UPDATE %s
                        SET family_id = '%s'
                        WHERE family_id IS NULL OR family_id = ''
                        """.formatted(table, DEFAULT_FAMILY_ID));
                statement.execute("""
                        UPDATE %s
                        SET created_by_user_id = CASE
                          WHEN owner_user_id IS NOT NULL AND owner_user_id != '' THEN owner_user_id
                          ELSE created_by_user_id
                        END
                        WHERE created_by_user_id IS NULL OR created_by_user_id = ''
                        """.formatted(table));
            }
            statement.execute("""
                    UPDATE attachment
                    SET family_id = '%s'
                    WHERE family_id IS NULL OR family_id = ''
                    """.formatted(DEFAULT_FAMILY_ID));
            statement.execute("""
                    UPDATE attachment
                    SET created_by_user_id = CASE
                      WHEN owner_user_id IS NOT NULL AND owner_user_id != '' THEN owner_user_id
                      ELSE created_by_user_id
                    END
                    WHERE created_by_user_id IS NULL OR created_by_user_id = ''
                    """);
        }
    }

    private void addColumnIfMissing(Connection connection, Statement statement, String tableName, String columnName, String type) throws Exception {
        try (ResultSet resultSet = connection.createStatement().executeQuery("PRAGMA table_info(" + tableName + ")")) {
            while (resultSet.next()) {
                if (columnName.equalsIgnoreCase(resultSet.getString("name"))) {
                    return;
                }
            }
        }
        statement.execute("ALTER TABLE " + tableName + " ADD COLUMN " + columnName + " " + type);
    }

    private void migrateExpenseBarcodeData(Connection connection) throws Exception {
        migrateExpenseTablePayloads(connection);
        migratePendingEffectExpensePayloads(connection);
    }

    private void migrateExpenseTablePayloads(Connection connection) throws Exception {
        try (
                PreparedStatement select = connection.prepareStatement("""
                        SELECT id, payload_json FROM expense_item
                        WHERE payload_json LIKE '%barcode%'
                           OR payload_json LIKE '%productImageUrl%'
                           OR payload_json LIKE '%"source":"barcode"%'
                           OR payload_json LIKE '%"source":"web"%'
                        """);
                PreparedStatement update = connection.prepareStatement("UPDATE expense_item SET payload_json = ? WHERE id = ?")
        ) {
            try (ResultSet resultSet = select.executeQuery()) {
                while (resultSet.next()) {
                    String id = resultSet.getString("id");
                    String payload = resultSet.getString("payload_json");
                    JsonNode node = objectMapper.readTree(payload);
                    if (!scrubExpenseNode(node)) continue;
                    update.setString(1, objectMapper.writeValueAsString(node));
                    update.setString(2, id);
                    update.addBatch();
                }
            }
            update.executeBatch();
        }
    }

    private void migratePendingEffectExpensePayloads(Connection connection) throws Exception {
        try (
                PreparedStatement select = connection.prepareStatement("""
                        SELECT id, payload_json FROM pending_effect
                        WHERE payload_json LIKE '%"expenses"%'
                          AND (
                            payload_json LIKE '%barcode%'
                            OR payload_json LIKE '%productImageUrl%'
                            OR payload_json LIKE '%"source":"barcode"%'
                            OR payload_json LIKE '%"source":"web"%'
                          )
                        """);
                PreparedStatement update = connection.prepareStatement("UPDATE pending_effect SET payload_json = ? WHERE id = ?")
        ) {
            try (ResultSet resultSet = select.executeQuery()) {
                while (resultSet.next()) {
                    String id = resultSet.getString("id");
                    String payload = resultSet.getString("payload_json");
                    JsonNode node = objectMapper.readTree(payload);
                    JsonNode expenses = node.path("expenses");
                    if (!(expenses instanceof ArrayNode expenseArray)) continue;
                    boolean changed = false;
                    for (JsonNode expense : expenseArray) {
                        changed = scrubExpenseNode(expense) || changed;
                    }
                    if (!changed) continue;
                    update.setString(1, objectMapper.writeValueAsString(node));
                    update.setString(2, id);
                    update.addBatch();
                }
            }
            update.executeBatch();
        }
    }

    private boolean scrubExpenseNode(JsonNode node) {
        if (!(node instanceof ObjectNode object)) return false;
        boolean changed = false;
        if (object.has("barcode")) {
            object.remove("barcode");
            changed = true;
        }
        if (object.has("productImageUrl")) {
            object.remove("productImageUrl");
            changed = true;
        }
        String source = object.path("source").asText("");
        if ("barcode".equals(source) || "web".equals(source)) {
            object.put("source", "manual");
            changed = true;
        }
        return changed;
    }

    private String[] recordTables() {
        return new String[]{
                "baby_profile",
                "chat_message",
                "growth_event",
                "growth_measurement",
                "care_log",
                "reminder",
                "memory_item",
                "pending_effect",
                "album_item",
                "expense_item",
                "conversation_summary"
        };
    }

    private boolean hasRows(Statement statement, String query) throws Exception {
        try (ResultSet resultSet = statement.executeQuery(query)) {
            return resultSet.next();
        }
    }
}
