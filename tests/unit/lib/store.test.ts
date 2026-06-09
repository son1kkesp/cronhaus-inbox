import { describe, it, expect, beforeEach } from 'vitest'
import { createStore } from '@/adapters/store'
import { seedLedger } from '@/core/ledger'

describe('createStore', () => {
  it('arranca sembrado con seedLedger()', () => {
    const store = createStore()
    const ledger = store.getLedger()
    const seed = seedLedger()
    expect(ledger).toHaveLength(seed.length)
    expect(ledger[0]).toEqual(seed[0])
    expect(ledger[1]).toEqual(seed[1])
  })

  it('getLedger devuelve una copia (no referencia mutable)', () => {
    const store = createStore()
    const ledger1 = store.getLedger()
    ledger1.push({ proveedor: 'X', numero: 'F-000', total: 1, base: 1, iva: 0, fecha: '2024-01-01', categoria: 'test' })
    const ledger2 = store.getLedger()
    expect(ledger2).toHaveLength(seedLedger().length)
  })
})

describe('applyEntry', () => {
  it('añade una entrada al ledger', () => {
    const store = createStore()
    const seedLen = seedLedger().length
    store.applyEntry({
      proveedor: 'Acme SL',
      numero: 'FAC-999',
      total: 242,
      base: 200,
      iva: 42,
      fecha: '2024-09-01',
      categoria: 'suministros',
    })
    expect(store.getLedger()).toHaveLength(seedLen + 1)
  })

  it('la entrada añadida tiene los datos correctos', () => {
    const store = createStore()
    const entry = {
      proveedor: 'Acme SL',
      numero: 'FAC-999',
      total: 242,
      base: 200,
      iva: 42,
      fecha: '2024-09-01',
      categoria: 'suministros',
    }
    store.applyEntry(entry)
    const ledger = store.getLedger()
    expect(ledger[ledger.length - 1]).toEqual(entry)
  })
})

describe('toCSV', () => {
  it('incluye cabecera con todos los campos', () => {
    const store = createStore()
    const csv = store.toCSV()
    expect(csv).toContain('proveedor')
    expect(csv).toContain('numero')
    expect(csv).toContain('total')
    expect(csv).toContain('base')
    expect(csv).toContain('iva')
    expect(csv).toContain('fecha')
    expect(csv).toContain('categoria')
  })

  it('exporta los asientos sembrados', () => {
    const store = createStore()
    const csv = store.toCSV()
    const seed = seedLedger()
    expect(csv).toContain(seed[0]!.proveedor)
    expect(csv).toContain(seed[1]!.numero)
  })

  it('exporta también entradas añadidas con applyEntry', () => {
    const store = createStore()
    store.applyEntry({
      proveedor: 'Nueva Empresa SA',
      numero: 'FAC-XYZ',
      total: 121,
      base: 100,
      iva: 21,
      fecha: '2024-12-01',
      categoria: 'consultoría',
    })
    const csv = store.toCSV()
    expect(csv).toContain('Nueva Empresa SA')
    expect(csv).toContain('FAC-XYZ')
  })

  it('dos instancias de createStore son independientes', () => {
    const storeA = createStore()
    const storeB = createStore()
    storeA.applyEntry({
      proveedor: 'Solo en A',
      numero: 'F-A',
      total: 1,
      base: 1,
      iva: 0,
      fecha: '2024-01-01',
      categoria: 'test',
    })
    expect(storeB.getLedger()).toHaveLength(seedLedger().length)
  })
})
