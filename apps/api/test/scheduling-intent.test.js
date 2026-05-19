import { describe, it } from "node:test";
import assert from "node:assert/strict";
import {
  acceptsVisitAffirmative,
  acceptsVisitAfterInvite,
  looksLikeSlotChoice,
  botMessageOfferedNumberedSlots,
  resolveVisitConfirmationReply,
  wantsReschedule,
  resolveQualificationChoice,
} from "../dist/lib/scheduling-intent.js";
import { findRequestedSlot } from "../dist/services/scheduling-service.js";

const slots = [
  {
    option: 1,
    startsAt: "2026-05-19T12:00:00.000Z",
    endsAt: "2026-05-19T13:00:00.000Z",
    label: "terça, 19/05 às 09:00",
  },
  {
    option: 2,
    startsAt: "2026-05-19T13:00:00.000Z",
    endsAt: "2026-05-19T14:00:00.000Z",
    label: "terça, 19/05 às 10:00",
  },
  {
    option: 3,
    startsAt: "2026-05-19T14:00:00.000Z",
    endsAt: "2026-05-19T15:00:00.000Z",
    label: "terça, 19/05 às 11:00",
  },
];

describe("acceptsVisitAffirmative", () => {
  for (const msg of [
    "Adoraria",
    "adoraria",
    "Adoraria!",
    "sim",
    "pode ser",
    "quero sim",
    "perfeito",
    "bora",
    "massa",
  ]) {
    it(`aceita: ${msg}`, () => {
      assert.equal(acceptsVisitAffirmative(msg), true);
    });
  }

  it("rejeita pergunta longa", () => {
    assert.equal(
      acceptsVisitAffirmative("Quanto custa o condomínio desse ap?"),
      false,
    );
  });
});

describe("acceptsVisitAfterInvite", () => {
  it("Adoraria após convite", () => {
    assert.equal(acceptsVisitAfterInvite("Adoraria"), true);
  });

  it("não confunde com opção", () => {
    assert.equal(acceptsVisitAfterInvite("Opção 3"), false);
  });

  it("rejeita negação", () => {
    assert.equal(acceptsVisitAfterInvite("Agora não"), false);
  });

  it("rejeita pergunta", () => {
    assert.equal(acceptsVisitAfterInvite("Qual o valor?"), false);
  });
});

describe("looksLikeSlotChoice", () => {
  for (const msg of ["Opção 3", "opcao 3", "3", "numero 3", "terceira"]) {
    it(`detecta: ${msg}`, () => {
      assert.equal(looksLikeSlotChoice(msg), true);
    });
  }
});

describe("findRequestedSlot", () => {
  it("Opção 3 → slot 3", () => {
    const picked = findRequestedSlot("Opção 3", slots, "America/Sao_Paulo");
    assert.equal(picked?.option, 3);
  });

  it("3 → slot 3", () => {
    const picked = findRequestedSlot("3", slots, "America/Sao_Paulo");
    assert.equal(picked?.option, 3);
  });

  it("opção 5 e data por extenso (quarta 20/05 09:00)", () => {
    const maySlots = [
      {
        option: 5,
        startsAt: "2026-05-20T12:00:00.000Z",
        endsAt: "2026-05-20T13:00:00.000Z",
        label: "quarta-feira, 20/05 às 09:00",
      },
    ];
    assert.equal(
      findRequestedSlot("opção 5", maySlots, "America/Sao_Paulo")?.option,
      5,
    );
    assert.equal(
      findRequestedSlot(
        "quarta-feira, 20/05 às 09:00",
        maySlots,
        "America/Sao_Paulo",
      )?.option,
      5,
    );
  });
});

describe("botMessageOfferedNumberedSlots", () => {
  const sample = `Perfeito! Tenho horários:
1) terça, 19/05 às 09:00
2) terça, 19/05 às 10:00
3) terça, 19/05 às 11:00
Qual número funciona melhor?`;

  it("detecta lista numerada da LLM", () => {
    assert.equal(botMessageOfferedNumberedSlots(sample), true);
  });
});

describe("wantsReschedule", () => {
  it("detecta alterar agenda e mudar data da visita", () => {
    assert.equal(
      wantsReschedule("Preciso alterar minha agenda seria possível?"),
      true,
    );
    assert.equal(wantsReschedule("Quero mudar a data da visita"), true);
  });
});

describe("resolveQualificationChoice vs remarcação", () => {
  it("não confunde mudar data com na visita", () => {
    assert.equal(resolveQualificationChoice("Quero mudar a data da visita"), null);
    assert.equal(wantsReschedule("Quero mudar a data da visita"), true);
  });
});

describe("resolveVisitConfirmationReply", () => {
  it("confirma com sim", () => {
    assert.equal(resolveVisitConfirmationReply("sim"), "confirm");
    assert.equal(resolveVisitConfirmationReply("Confirmo"), "confirm");
  });
  it("cancela com não", () => {
    assert.equal(resolveVisitConfirmationReply("não"), "decline");
    assert.equal(resolveVisitConfirmationReply("cancelar"), "decline");
  });
  it("ignora mensagem ambígua", () => {
    assert.equal(resolveVisitConfirmationReply("qual o endereço?"), null);
  });
});
