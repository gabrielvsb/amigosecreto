USE db_amigo_secreto;

CREATE TABLE IF NOT EXISTS participantes (
                                             id INT AUTO_INCREMENT PRIMARY KEY,
                                             nome VARCHAR(255) NOT NULL,
    telefone VARCHAR(50),
    grupo VARCHAR(100)
    );

CREATE TABLE IF NOT EXISTS sorteio (
                                       id INT AUTO_INCREMENT PRIMARY KEY,
                                       id_participante INT NOT NULL,
                                       id_amigo INT NOT NULL,
                                       mensagem_enviada TINYINT(1) DEFAULT 0,
    FOREIGN KEY (id_participante) REFERENCES participantes(id) ON DELETE CASCADE,
    FOREIGN KEY (id_amigo) REFERENCES participantes(id) ON DELETE CASCADE
    );