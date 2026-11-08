-- Andamentos passam a ser visíveis ao cliente por padrão (o escritório pode ocultar um a um).
alter table andamentos alter column visivel_cliente set default true;
update andamentos set visivel_cliente = true where visivel_cliente = false;
