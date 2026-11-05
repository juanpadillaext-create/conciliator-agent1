SELECT table_name 
FROM `peya-data-origins-pro.cl_dmarts.INFORMATION_SCHEMA.TABLES`
WHERE table_name LIKE '%purchase%' OR table_name LIKE '%po%' OR table_name LIKE '%dte%' OR table_name LIKE '%reception%' OR table_name LIKE '%invoice%'
ORDER BY table_name;
