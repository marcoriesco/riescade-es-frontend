/**
 * Classe para gerenciar os controles de gamepad
 * Adaptado para o RIESCADE com base na Web Gamepad API
 */
export class GamepadManager {
  constructor() {
    // Mapeamento de botões
    this.buttons = {
      a: 0, // Botão A (0) - geralmente usado para confirmar/selecionar
      b: 0, // Botão B (1) - geralmente usado para cancelar/voltar
      x: 0, // Botão X (2)
      y: 0, // Botão Y (3)
      lb: 0, // Botão LB (4) - bumper esquerdo
      rb: 0, // Botão RB (5) - bumper direito
      lt: 0, // Botão LT (6) - trigger esquerdo
      rt: 0, // Botão RT (7) - trigger direito
      select: 0, // Botão SELECT (8) - ou "back" em alguns controles
      start: 0, // Botão START (9) - usado para abrir o menu
      ls: 0, // Botão LS (10) - stick analógico esquerdo (pressionar)
      rs: 0, // Botão RS (11) - stick analógico direito (pressionar)
      dup: 0, // Direcional para cima (12)
      ddown: 0, // Direcional para baixo (13)
      dleft: 0, // Direcional para esquerda (14)
      dright: 0, // Direcional para direita (15)

      // Sticks analógicos (valores entre -1 e 1)
      leftstick_x: 0, // Horizontal do stick esquerdo
      leftstick_y: 0, // Vertical do stick esquerdo
      rightstick_x: 0, // Horizontal do stick direito
      rightstick_y: 0, // Vertical do stick direito
    };

    // Status de conexão
    this.connected = false;
    this.activeGamepad = null;

    // Callbacks para eventos de botões
    this.buttonCallbacks = {};

    // Threshold para considerar movimento do stick
    this.stickThreshold = 0.3;

    // Informações sobre o último input
    this.lastInput = {
      type: null,
      button: null,
      value: 0,
      timestamp: 0,
    };

    // Controle de debounce para evitar múltiplos eventos
    this.debounceTime = 50; // Aumentado para 300ms
    this.lastEventTime = {
      dup: 0,
      ddown: 0,
      dleft: 0,
      dright: 0,
      leftstick_x: 0,
      leftstick_y: 0,
      rightstick_x: 0,
      rightstick_y: 0,
    };

    // Controle de estado para evitar eventos repetidos
    this.buttonState = {
      dup: false,
      ddown: false,
      dleft: false,
      dright: false,
    };

    // Intervalo de polling (ms)
    this.pollingInterval = 16;
    this.pollingTimer = null;

    // Registrar handlers de eventos de conexão
    window.addEventListener(
      "gamepadconnected",
      this.handleGamepadConnected.bind(this)
    );
    window.addEventListener(
      "gamepaddisconnected",
      this.handleGamepadDisconnected.bind(this)
    );

    // Iniciar polling de gamepad
    this.startPolling();

    console.log(
      "[GamepadManager] Inicializado e aguardando conexão de controle"
    );
  }

  /**
   * Manipula evento de conexão de gamepad
   */
  handleGamepadConnected(event) {
    this.connected = true;
    this.activeGamepad = event.gamepad;
    console.log(
      `[GamepadManager] Controle conectado no índice ${event.gamepad.index}: ${event.gamepad.id}`
    );
    console.log(
      `[GamepadManager] ${event.gamepad.buttons.length} botões, ${event.gamepad.axes.length} eixos`
    );

    // Disparar evento personalizado
    this.dispatchCustomEvent("gamepadconnected", { gamepad: event.gamepad });
  }

  /**
   * Manipula evento de desconexão de gamepad
   */
  handleGamepadDisconnected(event) {
    this.connected = false;
    this.activeGamepad = null;
    console.log(`[GamepadManager] Controle desconectado: ${event.gamepad.id}`);

    // Disparar evento personalizado
    this.dispatchCustomEvent("gamepaddisconnected", { gamepad: event.gamepad });
  }

  /**
   * Inicia o polling de estado do gamepad
   */
  startPolling() {
    // Limpar timer existente se houver
    if (this.pollingTimer) {
      clearInterval(this.pollingTimer);
    }

    // Iniciar novo timer
    this.pollingTimer = setInterval(() => {
      this.update();
    }, this.pollingInterval);

    console.log(
      `[GamepadManager] Polling iniciado (intervalo: ${this.pollingInterval}ms)`
    );

    // Adicionar um log periódico para debug
    setInterval(() => {
      if (this.connected) {
        this.logGamepadState();
      }
    }, 5000); // A cada 5 segundos
  }

  /**
   * Registra o estado atual do gamepad para debug
   */
  logGamepadState() {
    const gamepads = navigator.getGamepads ? navigator.getGamepads() : [];
    let gamepad = null;

    for (let i = 0; i < gamepads.length; i++) {
      if (gamepads[i]) {
        gamepad = gamepads[i];
        break;
      }
    }

    if (!gamepad) return;

    console.log("=== GAMEPAD DEBUG INFO ===");
    console.log(`ID: ${gamepad.id}`);
    console.log(`Botões: ${gamepad.buttons.length}`);
    console.log(`Eixos: ${gamepad.axes.length}`);

    // Log dos botões do D-PAD
    if (gamepad.buttons.length > 15) {
      console.log("D-PAD:");
      console.log(`  UP (12): ${gamepad.buttons[12].value}`);
      console.log(`  DOWN (13): ${gamepad.buttons[13].value}`);
      console.log(`  LEFT (14): ${gamepad.buttons[14].value}`);
      console.log(`  RIGHT (15): ${gamepad.buttons[15].value}`);
    } else {
      console.log(
        `D-PAD não encontrado nos botões padrão (total: ${gamepad.buttons.length})`
      );
    }

    // Log dos eixos analógicos
    if (gamepad.axes.length > 3) {
      console.log("Sticks:");
      console.log(`  LEFT X (0): ${gamepad.axes[0]}`);
      console.log(`  LEFT Y (1): ${gamepad.axes[1]}`);
      console.log(`  RIGHT X (2): ${gamepad.axes[2]}`);
      console.log(`  RIGHT Y (3): ${gamepad.axes[3]}`);
    }

    // Verificar se há eixos adicionais que podem ser o D-PAD
    if (gamepad.axes.length > 8) {
      console.log("Eixos adicionais (possível D-PAD):");
      for (let i = 8; i < Math.min(gamepad.axes.length, 12); i++) {
        console.log(`  Eixo ${i}: ${gamepad.axes[i]}`);
      }
    }

    console.log("=========================");
  }

  /**
   * Para o polling de estado do gamepad
   */
  stopPolling() {
    if (this.pollingTimer) {
      clearInterval(this.pollingTimer);
      this.pollingTimer = null;
      console.log("[GamepadManager] Polling interrompido");
    }
  }

  /**
   * Atualiza o estado dos botões e sticks
   */
  update() {
    // Obter lista atual de gamepads
    const gamepads = navigator.getGamepads ? navigator.getGamepads() : [];

    // Verificar primeiro gamepad disponível
    let gamepad = null;
    for (let i = 0; i < gamepads.length; i++) {
      if (gamepads[i]) {
        gamepad = gamepads[i];
        break;
      }
    }

    // Se não houver gamepad, sair
    if (!gamepad) {
      if (this.connected) {
        console.log(
          "[GamepadManager] Controle não detectado, mas estava conectado anteriormente"
        );
        this.connected = false;
        this.activeGamepad = null;
      }
      return;
    }

    // Marcar como conectado se não estava antes
    if (!this.connected) {
      this.connected = true;
      this.activeGamepad = gamepad;
      this.dispatchCustomEvent("gamepadconnected", { gamepad });
    }

    // Salvar estado anterior para detecção de mudanças
    const prevButtons = { ...this.buttons };

    // Atualizar estado dos botões principais
    this.buttons.a = gamepad.buttons[0].value;
    this.buttons.b = gamepad.buttons[1].value;
    this.buttons.x = gamepad.buttons[2].value;
    this.buttons.y = gamepad.buttons[3].value;
    this.buttons.lb = gamepad.buttons[4].value;
    this.buttons.rb = gamepad.buttons[5].value;
    this.buttons.lt = gamepad.buttons[6].value;
    this.buttons.rt = gamepad.buttons[7].value;
    this.buttons.select = gamepad.buttons[8].value;
    this.buttons.start = gamepad.buttons[9].value;
    this.buttons.ls = gamepad.buttons[10].value;
    this.buttons.rs = gamepad.buttons[11].value;

    // Atualizar D-PAD - Mapeamento padrão (botões 12-15)
    if (gamepad.buttons.length > 15) {
      this.buttons.dup = gamepad.buttons[12].value;
      this.buttons.ddown = gamepad.buttons[13].value;
      this.buttons.dleft = gamepad.buttons[14].value;
      this.buttons.dright = gamepad.buttons[15].value;

      // Log do estado do D-PAD
      if (this.buttons.dup > 0.5)
        console.log("[GamepadManager] D-PAD UP pressed");
      if (this.buttons.ddown > 0.5)
        console.log("[GamepadManager] D-PAD DOWN pressed");
      if (this.buttons.dleft > 0.5)
        console.log("[GamepadManager] D-PAD LEFT pressed");
      if (this.buttons.dright > 0.5)
        console.log("[GamepadManager] D-PAD RIGHT pressed");
    }

    // Atualizar estado dos sticks analógicos
    if (gamepad.axes.length > 0) this.buttons.leftstick_x = gamepad.axes[0];
    if (gamepad.axes.length > 1) this.buttons.leftstick_y = gamepad.axes[1];
    if (gamepad.axes.length > 2) this.buttons.rightstick_x = gamepad.axes[2];
    if (gamepad.axes.length > 3) this.buttons.rightstick_y = gamepad.axes[3];

    // Detectar mudanças e chamar callbacks
    const now = Date.now();
    const buttonKeys = Object.keys(this.buttons);

    for (const button of buttonKeys) {
      // Se o valor mudou significativamente...
      if (Math.abs(this.buttons[button] - prevButtons[button]) > 0.1) {
        const isAnalogStick = button.includes("stick");

        // Verificar debounce para sticks
        if (
          isAnalogStick &&
          now - this.lastEventTime[button] < this.debounceTime
        ) {
          continue;
        }

        // Log de mudança de estado
        console.log(
          `[GamepadManager] Button ${button} changed: ${this.buttons[button]}`
        );

        // Atualizar último input
        this.lastInput = {
          type: isAnalogStick ? "axis" : "button",
          button: button,
          value: this.buttons[button],
          timestamp: now,
        };

        // Apenas disparar para sticks se passar do threshold
        if (
          !isAnalogStick ||
          Math.abs(this.buttons[button]) > this.stickThreshold
        ) {
          if (isAnalogStick) {
            this.lastEventTime[button] = now;
          }

          // Disparar callbacks
          this.triggerButtonCallbacks(button, this.buttons[button]);

          // Disparar evento personalizado
          this.dispatchCustomEvent("gamepadinput", {
            button: button,
            value: this.buttons[button],
            isPressed: !isAnalogStick && this.buttons[button] > 0.5,
            isAxis: isAnalogStick,
          });
        }
      }
    }
  }

  /**
   * Obtém o valor atual de um botão
   */
  getButtonValue(button) {
    return this.connected ? this.buttons[button] || 0 : 0;
  }

  /**
   * Verifica se um botão está pressionado
   */
  isButtonPressed(button) {
    return this.getButtonValue(button) > 0.5;
  }

  /**
   * Registra um callback para um botão específico
   */
  onButtonPress(button, callback) {
    if (!this.buttonCallbacks[button]) {
      this.buttonCallbacks[button] = [];
    }
    this.buttonCallbacks[button].push(callback);

    return {
      remove: () => {
        this.buttonCallbacks[button] = this.buttonCallbacks[button].filter(
          (cb) => cb !== callback
        );
      },
    };
  }

  /**
   * Dispara todos os callbacks registrados para um botão
   */
  triggerButtonCallbacks(button, value) {
    if (this.buttonCallbacks[button]) {
      this.buttonCallbacks[button].forEach((callback) => {
        try {
          callback(value, button);
        } catch (error) {
          console.error(
            `[GamepadManager] Erro ao executar callback para botão ${button}:`,
            error
          );
        }
      });
    }
  }

  /**
   * Dispara um evento personalizado
   */
  dispatchCustomEvent(eventName, detail) {
    const event = new CustomEvent(`gamepad:${eventName}`, {
      detail: detail,
      bubbles: true,
      cancelable: true,
    });
    document.dispatchEvent(event);
  }

  /**
   * Configura modo de vibração do gamepad (se suportado)
   */
  vibrate(duration = 200, strongMagnitude = 1.0, weakMagnitude = 1.0) {
    if (!this.connected || !this.activeGamepad) {
      return false;
    }

    // Verificar se a API de vibração é suportada
    if (
      "vibrationActuator" in this.activeGamepad &&
      this.activeGamepad.vibrationActuator
    ) {
      try {
        this.activeGamepad.vibrationActuator.playEffect("dual-rumble", {
          startDelay: 0,
          duration: duration,
          weakMagnitude: weakMagnitude,
          strongMagnitude: strongMagnitude,
        });
        return true;
      } catch (error) {
        console.error(
          "[GamepadManager] Erro ao tentar vibrar o controle:",
          error
        );
        return false;
      }
    }

    return false;
  }

  /**
   * Verifica se algum gamepad está conectado
   */
  isGamepadConnected() {
    return this.connected;
  }

  /**
   * Obtém informações sobre o gamepad conectado
   */
  getGamepadInfo() {
    if (!this.connected || !this.activeGamepad) {
      return null;
    }

    return {
      id: this.activeGamepad.id,
      index: this.activeGamepad.index,
      buttons: this.activeGamepad.buttons.length,
      axes: this.activeGamepad.axes.length,
    };
  }

  /**
   * Obtém informações sobre o último input recebido
   */
  getLastInput() {
    return { ...this.lastInput };
  }
}
