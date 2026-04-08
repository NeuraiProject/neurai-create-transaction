# Mejoras Para `neurai-assets` y `neurai-create-transaction`

## Objetivo

Eliminar lógica de integración específica del addon y moverla a las librerías upstream para que:

- `@neuraiproject/neurai-assets` siga siendo el builder de alto nivel
- `@neuraiproject/neurai-create-transaction` sea el serializador raw de bajo nivel
- el addon no tenga que inferir burn outputs, change outputs, tipos de operación ni conversiones lógicas a raw

El objetivo final es que el addon deje de interceptar `createrawtransaction` de forma artesanal y pase a consumir una API estable entre ambas librerías.

## Problemas actuales

Ahora mismo el addon tiene que reconstruir localmente una transacción a partir del `buildResult` lógico de `neurai-assets`.

Eso obliga a hacer en la app cosas que no deberían vivir ahí:

- inferir `operationType` desde `outputs`
- detectar qué salida XNA es burn y cuál es cambio
- convertir cantidades lógicas a cantidades raw
- decidir cómo mapear cada output lógico a un builder concreto de `neurai-create-transaction`
- meter excepciones especiales para algunos casos, como `TAG/UNTAG` PQ

Esto hace el sistema frágil porque el contrato entre ambas librerías es incompleto.

## Arquitectura recomendada

### Rol de `@neuraiproject/neurai-assets`

Debe encargarse de:

- validación de parámetros de negocio
- selección de UTXOs
- cálculo de burn
- cálculo de fee
- cálculo de cambio
- orden lógico de outputs
- metadatos de operación

Y debe exponer un resultado estructurado y explícito, no solo `outputs`.

### Rol de `@neuraiproject/neurai-create-transaction`

Debe encargarse de:

- convertir una estructura intermedia estable a `unsignedRawTx`
- serializar `P2PKH`, `PQ witness v1`, asset transfers, null asset data, restricted, verifier, etc.
- no depender del nodo para `createrawtransaction`

### Rol del addon

Debe limitarse a:

- pedir a `neurai-assets` el build
- firmar
- ajustar fee si hace falta
- emitir

Sin reinterpretar la transacción.

## Cambio principal necesario

La clave es definir una estructura intermedia común entre ambas librerías.

## Cambios recomendados en `@neuraiproject/neurai-assets`

### 1. Incluir metadatos explícitos en `formatResult(...)`

El resultado final de cada builder debería incluir al menos:

```ts
type AssetBuildResult = {
  rawTx?: string;
  inputs: Array<{
    txid: string;
    vout: number;
    address: string;
    satoshis: number;
    assetName?: string;
  }>;
  outputs: Array<Record<string, unknown>>;
  fee: number;
  burnAmount: number;

  operationType:
    | 'ISSUE_ROOT'
    | 'ISSUE_SUB'
    | 'ISSUE_DEPIN'
    | 'ISSUE_UNIQUE'
    | 'ISSUE_QUALIFIER'
    | 'ISSUE_SUB_QUALIFIER'
    | 'ISSUE_RESTRICTED'
    | 'REISSUE'
    | 'REISSUE_RESTRICTED'
    | 'TAG_ADDRESSES'
    | 'UNTAG_ADDRESSES'
    | 'FREEZE_ADDRESSES'
    | 'UNFREEZE_ADDRESSES'
    | 'FREEZE_ASSET'
    | 'UNFREEZE_ASSET';

  network: string;
  burnAddress?: string;
  changeAddress?: string;
  changeAmount?: number;
};
```

Esto evita que el consumidor tenga que deducir burn y change mirando `outputs`.

### 2. Añadir `toRawBuildParams()`

Cada builder debería poder devolver una estructura lista para pasar a `neurai-create-transaction`.

Ejemplo:

```ts
type LocalRawBuildParams =
  | {
      operationType: 'ISSUE_QUALIFIER';
      params: {
        inputs: TxInput[];
        burnAddress: string;
        burnAmountSats: bigint | number;
        xnaChangeAddress?: string;
        xnaChangeSats?: bigint | number;
        toAddress: string;
        assetName: string;
        quantityRaw: bigint | number;
        ipfsHash?: string;
        rootChangeAddress?: string;
        changeQuantityRaw?: bigint | number;
      };
    }
  | ...
```

Idealmente:

```ts
const build = await neuraiAssets.createQualifier(...);
const rawParams = build.toRawBuildParams();
const raw = NeuraiCreateTransaction.createFromOperation(rawParams);
```

### 3. Añadir opción de construcción local

`neurai-assets` debería soportar algo como:

```ts
const neuraiAssets = new NeuraiAssets(rpc, {
  network,
  txBuilder: NeuraiCreateTransaction
});
```

o:

```ts
const neuraiAssets = new NeuraiAssets(rpc, {
  network,
  buildRawTxLocally: true
});
```

Y entonces, internamente:

- si hay `txBuilder`, usarlo
- si no, seguir usando `createrawtransaction` del nodo

Así el fallback al nodo queda centralizado en la librería, no repartido por consumidores.

### 4. No hacer que el consumidor deduzca cantidades raw

Hoy el addon tiene que convertir:

- `asset_quantity` lógico
- `change_quantity`
- valores según `units`

Eso debe salir ya resuelto desde `neurai-assets`.

Recomendación:

- mantener campos lógicos para debug
- añadir siempre campos raw equivalentes en el contrato hacia `neurai-create-transaction`

Ejemplo:

```ts
issue_qualifier: {
  asset_name: '#QUALITY',
  asset_quantity: 4,
  asset_quantity_raw: 400000000,
  has_ipfs: 0,
  ipfs_hash: ''
}
```

## Cambios recomendados en `@neuraiproject/neurai-create-transaction`

### 1. Añadir un adaptador desde `neurai-assets`

Ahora mismo la librería funciona bien si se le pasan params correctos, pero le falta un adaptador estable.

Añadir:

```ts
createFromOperation(build: LocalRawBuildParams): BuiltTransaction
```

o:

```ts
fromNeuraiAssetsBuildResult(buildResult: AssetBuildResult): BuiltTransaction
```

Mi recomendación es la primera: mejor contrato explícito y tipado que parsear `outputs`.

### 2. Exponer tipos públicos de operación

Publicar de forma clara:

```ts
type OperationType =
  | 'ISSUE_ROOT'
  | 'ISSUE_SUB'
  | 'ISSUE_DEPIN'
  | 'ISSUE_UNIQUE'
  | 'ISSUE_QUALIFIER'
  | 'ISSUE_SUB_QUALIFIER'
  | 'ISSUE_RESTRICTED'
  | 'REISSUE'
  | 'REISSUE_RESTRICTED'
  | 'TAG_ADDRESSES'
  | 'UNTAG_ADDRESSES'
  | 'FREEZE_ADDRESSES'
  | 'UNFREEZE_ADDRESSES'
  | 'FREEZE_ASSET'
  | 'UNFREEZE_ASSET';
```

Y:

```ts
type CreateTransactionOperation =
  | { operationType: 'ISSUE_QUALIFIER'; params: IssueQualifierTransactionParams }
  | ...
```

### 3. Exponer helpers de detección y envelope

Aunque la idea es que `neurai-assets` lo pase ya resuelto, conviene que `neurai-create-transaction` tenga helpers públicos para:

- `getBurnAddressForOperation(network, operation)`
- `getBurnAmountSats(operation, multiplier?)`
- `inferNetworkFromAnyAddress(address)`

Eso ya existe en gran parte. Debe mantenerse como API pública estable.

### 4. Añadir pruebas cruzadas con fixtures de `neurai-assets`

Esta librería ya tiene tests de serialización. Lo que falta consolidar es el contrato entre ambas librerías.

Añadir fixtures tipo:

```ts
{
  operationType: 'ISSUE_QUALIFIER',
  params: ...,
  expectedRawTx: '...'
}
```

generadas desde builds reales de `neurai-assets`.

## Contrato recomendado entre ambas librerías

### Opción preferida

`neurai-assets` genera params listos para `neurai-create-transaction`.

```ts
const build = await neuraiAssets.createQualifier({
  qualifierName: '#QUALITY',
  quantity: 4,
  toAddress: '...'
});

const local = build.localRawBuild;
const rawTx = NeuraiCreateTransaction.createFromOperation(local).rawTx;
```

### Opción alternativa

`neurai-assets` acepta `txBuilder` y lo usa internamente.

```ts
const neuraiAssets = new NeuraiAssets(rpc, {
  network: 'xna-test',
  txBuilder: NeuraiCreateTransaction
});

const build = await neuraiAssets.createQualifier(...);
```

Internamente:

- selecciona inputs
- calcula burn y fee
- construye params tipados
- llama al builder local

Esta opción es la mejor para consumidores como el addon.

## Cosas concretas que deberían salir del addon

Cuando esto esté upstream, en el addon deberían desaparecer estas piezas:

- inferencia manual de `operationType`
- detección manual de `burnAddress`
- detección manual de `changeAddress`
- `logicalAssetQuantityToRaw(...)`
- bridge que intercepta `createrawtransaction`
- excepciones locales por tipo de operación

## Problemas reales que esto evita

### 1. Burn address mal detectada

Caso real ya visto:

- `tQuaLifier...` no se detectó como burn
- el bridge interpretó esa salida como cambio
- el cambio real desapareció
- resultado: `absurdly-high-fee`

Si `neurai-assets` hubiese expuesto `burnAddress` y `changeAddress`, esto no habría pasado.

### 2. Cantidades lógicas vs raw

Caso real ya visto:

- `asset_quantity` lógico se pasó como si fuera cantidad raw
- el nodo rechazó por divisibilidad/unidades

Si el contrato entre ambas librerías incluyese `quantityRaw`, esto no habría pasado.

### 3. Casos especiales PQ

Caso real ya visto:

- `TAG` PQ necesita un tratamiento delicado de `nullassetdata`
- hoy el addon tiene que meter fallback y lógica especial

Eso debería vivir en la librería que conoce el formato de serialización, no en la UI.

## Orden recomendado de implementación

### Fase 1

En `neurai-assets`:

- añadir `operationType`
- añadir `network`
- añadir `burnAddress`
- añadir `changeAddress`
- añadir `changeAmount`
- añadir cantidades raw cuando aplique

Sin romper la API actual.

### Fase 2

En `neurai-create-transaction`:

- añadir `createFromOperation(...)`
- añadir tipos públicos para el contrato de operación

### Fase 3

En `neurai-assets`:

- añadir `txBuilder` opcional
- usarlo para construir `rawTx` localmente

### Fase 4

En el addon:

- eliminar el bridge actual
- consumir directamente la nueva API

## Tests recomendados

### En `neurai-assets`

- cada builder debe testear que devuelve `operationType`, `burnAddress`, `changeAddress`, `changeAmount`
- tests específicos para:
  - `ISSUE_QUALIFIER`
  - `TAG_ADDRESSES`
  - `ISSUE_RESTRICTED`
  - `REISSUE_RESTRICTED`
  - `FREEZE_ADDRESSES`
  - casos PQ

### En `neurai-create-transaction`

- tests para `createFromOperation(...)`
- fixtures de serialización cruzada desde resultados de `neurai-assets`
- casos legacy y PQ

### End-to-end entre ambas

- build lógico en `neurai-assets`
- serialización local en `neurai-create-transaction`
- comparación contra raw esperada

## Recomendación final

La mejor solución a futuro es:

1. `neurai-assets` calcula y describe la operación
2. `neurai-create-transaction` serializa esa descripción
3. el addon solo coordina firma y broadcast

Mientras el addon tenga que reinterpretar `outputs`, seguirá habiendo bugs de integración.

## Resumen corto

Qué mover a librerías:

- metadatos explícitos de burn/change/operation
- cantidades raw ya resueltas
- adaptador entre build lógico y raw tx
- fallback interno entre builder local y nodo

Qué quitar del addon después:

- inferencias
- heurísticas
- bridges manuales
- excepciones por operación
